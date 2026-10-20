using UnityEngine;
using UnityEngine.Events;
using System;
using System.Net.Sockets;
using System.Text;
using System.Threading.Tasks;
using System.Collections;
using System.Collections.Generic;

/// <summary>
/// Main game controller for Axial that orchestrates AI and human turns.
/// Manages the connection to Python AI server and game state.
/// 
/// COORDINATE MAPPING:
/// Unity GridManager: boardGrid[x, y, z] where x=column(0-6), y=height(0-5), z=row(0-5)
/// Python FastBitBoard: idx = h + r*D + c*D*R where D=6(height), R=6(rows), C=7(cols)
/// Mapping: Unity x = Python col, Unity y = Python h, Unity z = Python row
/// </summary>
public class AxialGameController : MonoBehaviour
{
    #region Enums

    public enum Difficulty
    {
        Easy = 200,      // 200 simulations
        Medium = 500,    // 500 simulations
        Hard = 1000,     // 1000 simulations
        Nightmare = 2000 // 2000 simulations
    }

    public enum GameState
    {
        NotStarted,
        WaitingForConnection,
        HumanTurn,
        AIThinking,
        GameOver
    }

    #endregion

    #region Serialized Fields

    [Header("Server Settings")]
    [SerializeField] private string serverHost = "127.0.0.1";
    [SerializeField] private int serverPort = 5555;
    [SerializeField] private float connectionTimeout = 5f;
    [SerializeField] private bool autoConnectOnStart = true;

    [Header("Game Settings")]
    [SerializeField] private Difficulty difficulty = Difficulty.Hard;
    [SerializeField] private bool aiGoesFirstInitially = false;
    
    [Tooltip("Automatically alternate who goes first each game")]
    [SerializeField] private bool alternateFirstPlayer = true;

    [Header("References")]
    [SerializeField] private GridManager gridManager;
    [SerializeField] private PieceSpawner pieceSpawner;

    [Header("Visual Feedback")]
    [Tooltip("Material to apply to AI pieces (optional)")]
    [SerializeField] private Material aiPieceMaterial;
    [Tooltip("Material to apply to human pieces (optional)")]
    [SerializeField] private Material humanPieceMaterial;

    [Header("Events")]
    public UnityEvent OnConnected;
    public UnityEvent OnDisconnected;
    public UnityEvent<string> OnConnectionError;
    public UnityEvent OnGameStarted;
    public UnityEvent OnHumanTurnStart;
    public UnityEvent OnAIThinkingStart;
    public UnityEvent<float> OnAIThinkingProgress;  // 0-1 progress estimate
    public UnityEvent<int, int> OnAIMoveReceived;   // col, row (Unity coords)
    public UnityEvent<int, string> OnGameOver;      // winner, message

    [Header("Debug")]
    [SerializeField] private bool enableDebugLogs = true;

    #endregion

    #region Private Fields

    private TcpClient _client;
    private NetworkStream _stream;
    private GameState _gameState = GameState.NotStarted;
    private bool _isConnected = false;
    
    // Player tracking
    private int _aiPlayer = 2;      // AI is usually player 2
    private int _humanPlayer = 1;   // Human is usually player 1
    private int _currentPlayer = 1; // Player 1 always starts
    private int _gamesPlayed = 0;
    private bool _aiGoesFirst = false;
    
    // Board dimensions (must match GridManager and Python)
    private const int COLS = 7;   // columnsX / C
    private const int HEIGHT = 6; // rowsY / D  
    private const int ROWS = 6;   // depthZ / R
    
    // AI thinking time tracking
    private float _aiThinkStartTime;
    private Coroutine _thinkingProgressCoroutine;

    // Thread-safe action queue
    private readonly Queue<Action> _mainThreadActions = new Queue<Action>();
    private readonly object _queueLock = new object();

    #endregion

    #region Public Properties

    public bool IsConnected => _isConnected;
    public GameState CurrentState => _gameState;
    public int AIPlayer => _aiPlayer;
    public int HumanPlayer => _humanPlayer;
    public int CurrentPlayer => _currentPlayer;
    public bool IsHumanTurn => _gameState == GameState.HumanTurn && _currentPlayer == _humanPlayer;
    public bool IsAITurn => _currentPlayer == _aiPlayer;
    public Difficulty CurrentDifficulty => difficulty;

    #endregion

    #region Unity Lifecycle

    private void Awake()
    {
        // Initialize events
        OnConnected ??= new UnityEvent();
        OnDisconnected ??= new UnityEvent();
        OnConnectionError ??= new UnityEvent<string>();
        OnGameStarted ??= new UnityEvent();
        OnHumanTurnStart ??= new UnityEvent();
        OnAIThinkingStart ??= new UnityEvent();
        OnAIThinkingProgress ??= new UnityEvent<float>();
        OnAIMoveReceived ??= new UnityEvent<int, int>();
        OnGameOver ??= new UnityEvent<int, string>();
    }

    private void Start()
    {
        // Auto-find references
        if (gridManager == null)
            gridManager = FindAnyObjectByType<GridManager>();
        if (pieceSpawner == null)
            pieceSpawner = FindAnyObjectByType<PieceSpawner>();

        // Validate dimensions match
        if (gridManager != null)
        {
            if (gridManager.columnsX != COLS || gridManager.rowsY != HEIGHT || gridManager.depthZ != ROWS)
            {
                Debug.LogWarning($"[AxialGame] GridManager dimensions ({gridManager.columnsX}x{gridManager.rowsY}x{gridManager.depthZ}) " +
                               $"don't match expected ({COLS}x{HEIGHT}x{ROWS}). AI may not work correctly.");
            }
            
            // Subscribe to GridManager events
            gridManager.OnPieceLanded += OnPieceLandedFromGrid;
            gridManager.OnPlayerWins += OnPlayerWinsHandler;
            gridManager.OnGameDraw += OnGameDrawHandler;
        }

        _aiGoesFirst = aiGoesFirstInitially;

        if (autoConnectOnStart)
        {
            ConnectAndStartGame();
        }
    }

    private void OnPlayerWinsHandler(int player)
    {
        _gameState = GameState.GameOver;
        string message = player == _humanPlayer ? "You Win!" : "AI Wins!";
        Log($"Game over (from Unity): {message}");
        // Note: Python also detects wins, but Unity can show immediate feedback
    }

    private void OnGameDrawHandler()
    {
        _gameState = GameState.GameOver;
        Log("Game over (from Unity): Draw!");
    }

    private void Update()
    {
        // Process main thread actions
        lock (_queueLock)
        {
            while (_mainThreadActions.Count > 0)
            {
                _mainThreadActions.Dequeue()?.Invoke();
            }
        }
    }

    private void OnDestroy()
    {
        // Unsubscribe from events
        if (gridManager != null)
        {
            gridManager.OnPieceLanded -= OnPieceLandedFromGrid;
            gridManager.OnPlayerWins -= OnPlayerWinsHandler;
            gridManager.OnGameDraw -= OnGameDrawHandler;
        }
        
        Disconnect();
    }

    private void OnApplicationQuit()
    {
        Disconnect();
    }

    #endregion

    #region Public Methods - Connection

    /// <summary>
    /// Connect to the Python AI server and start a new game.
    /// </summary>
    public async void ConnectAndStartGame()
    {
        if (_isConnected)
        {
            Log("Already connected");
            return;
        }

        _gameState = GameState.WaitingForConnection;
        Log($"Connecting to {serverHost}:{serverPort}...");

        try
        {
            _client = new TcpClient();
            
            var connectTask = _client.ConnectAsync(serverHost, serverPort);
            if (await Task.WhenAny(connectTask, Task.Delay(TimeSpan.FromSeconds(connectionTimeout))) != connectTask)
            {
                throw new TimeoutException("Connection timed out");
            }

            await connectTask;

            _stream = _client.GetStream();
            _isConnected = true;

            EnqueueMainThread(() =>
            {
                Log("Connected to AI server!");
                OnConnected?.Invoke();
            });

            // Initialize the game
            await InitializeGame();
        }
        catch (Exception e)
        {
            _gameState = GameState.NotStarted;
            EnqueueMainThread(() =>
            {
                LogError($"Connection failed: {e.Message}");
                OnConnectionError?.Invoke(e.Message);
            });
        }
    }

    /// <summary>
    /// Disconnect from the server.
    /// </summary>
    public void Disconnect()
    {
        if (!_isConnected) return;

        try
        {
            if (_stream != null && _client?.Connected == true)
            {
                SendMessageSync(new { type = "quit" });
            }
        }
        catch { }

        try
        {
            _stream?.Close();
            _client?.Close();
        }
        catch { }

        _stream = null;
        _client = null;
        _isConnected = false;
        _gameState = GameState.NotStarted;

        if (_thinkingProgressCoroutine != null)
            StopCoroutine(_thinkingProgressCoroutine);

        Log("Disconnected");
        OnDisconnected?.Invoke();
    }

    #endregion

    #region Public Methods - Game Control

    /// <summary>
    /// Start a new game (reset board and reconnect if needed).
    /// </summary>
    public async void NewGame()
    {
        if (!_isConnected)
        {
            ConnectAndStartGame();
            return;
        }

        // Alternate first player
        if (alternateFirstPlayer)
        {
            _aiGoesFirst = (_gamesPlayed % 2 == 1);
        }
        _gamesPlayed++;

        // Reset Unity board
        gridManager?.ResetBoard();
        
        // Clear existing pieces (you might need to implement this in PieceSpawner)
        if (pieceSpawner != null)
        {
            // pieceSpawner.ClearAllPieces();
        }

        // Send reset to Python
        var response = await SendMessageAsync(new
        {
            type = "reset",
            ai_plays_first = _aiGoesFirst
        });

        if (response != null && response.ContainsKey("ai_player"))
        {
            _aiPlayer = Convert.ToInt32(response["ai_player"]);
            _humanPlayer = 3 - _aiPlayer;
            _currentPlayer = 1;

            Log($"New game started. AI is Player {_aiPlayer}, goes first: {_aiGoesFirst}");

            EnqueueMainThread(() =>
            {
                OnGameStarted?.Invoke();

                if (_aiGoesFirst)
                {
                    _gameState = GameState.AIThinking;
                    OnAIThinkingStart?.Invoke();
                }
                else
                {
                    _gameState = GameState.HumanTurn;
                    OnHumanTurnStart?.Invoke();
                }
            });

            // If AI goes first, request its move
            if (_aiGoesFirst)
            {
                await RequestAIFirstMove();
            }
        }
    }

    /// <summary>
    /// Set difficulty level (only before game starts or between games).
    /// </summary>
    public void SetDifficulty(Difficulty newDifficulty)
    {
        difficulty = newDifficulty;
        Log($"Difficulty set to {difficulty} ({(int)difficulty} simulations)");
    }


    /// <param name="unityCol">Column in Unity coords (x)</param>
    /// <param name="unityRow">Row in Unity coords (z/depth)</param>
    public void OnHumanMove(int unityCol, int unityRow)
    {
        if (_gameState != GameState.HumanTurn)
        {
            Log($"Ignoring human move - not human's turn (state: {_gameState})");
            return;
        }

        if (_currentPlayer != _humanPlayer)
        {
            Log($"Ignoring move - current player is {_currentPlayer}, human is {_humanPlayer}");
            return;
        }

        Log($"Human move: Unity[col={unityCol}, row={unityRow}]");
        
        // Convert Unity coords to Python coords
        // Unity: x=col(0-6), z=row(0-5) 
        // Python: row=r(0-5), col=c(0-6)
        int pythonRow = unityRow;  // Unity z -> Python r
        int pythonCol = unityCol;  // Unity x -> Python c

        _ = SendHumanMoveAndGetAIResponse(pythonRow, pythonCol);
    }


    public void OnPieceLandedFromGrid(int x, int z, int player)
    {
        // Only process human moves
        if (player == _humanPlayer)
        {
            OnHumanMove(x, z);
        }
    }

    #endregion

    #region Private Methods - Game Logic

    private async Task InitializeGame()
    {
        if (alternateFirstPlayer && _gamesPlayed > 0)
        {
            _aiGoesFirst = (_gamesPlayed % 2 == 1);
        }

        string difficultyStr = difficulty.ToString().ToLower();

        var response = await SendMessageAsync(new
        {
            type = "init",
            difficulty = difficultyStr,
            ai_plays_first = _aiGoesFirst
        });

        if (response != null && response.ContainsKey("ai_player"))
        {
            _aiPlayer = Convert.ToInt32(response["ai_player"]);
            _humanPlayer = 3 - _aiPlayer;
            _currentPlayer = 1;

            EnqueueMainThread(() =>
            {
                Log($"Game initialized. AI=P{_aiPlayer}, Human=P{_humanPlayer}, Difficulty={difficulty}");
                OnGameStarted?.Invoke();

                if (_aiGoesFirst)
                {
                    _gameState = GameState.AIThinking;
                    OnAIThinkingStart?.Invoke();
                }
                else
                {
                    _gameState = GameState.HumanTurn;
                    OnHumanTurnStart?.Invoke();
                }
            });

            if (_aiGoesFirst)
            {
                await RequestAIFirstMove();
            }

            _gamesPlayed++;
        }
    }

    private async Task SendHumanMoveAndGetAIResponse(int pythonRow, int pythonCol)
    {
        _gameState = GameState.AIThinking;
        EnqueueMainThread(() => OnAIThinkingStart?.Invoke());

        _aiThinkStartTime = Time.time;
        _thinkingProgressCoroutine = StartCoroutine(UpdateThinkingProgress());

        Log($"Sending human move to Python: row={pythonRow}, col={pythonCol}");

        var response = await SendMessageAsync(new
        {
            type = "move",
            row = pythonRow,
            col = pythonCol
        });

        if (_thinkingProgressCoroutine != null)
        {
            StopCoroutine(_thinkingProgressCoroutine);
            _thinkingProgressCoroutine = null;
        }

        if (response == null)
        {
            LogError("No response from AI server");
            _gameState = GameState.HumanTurn;
            return;
        }

        string responseType = response.ContainsKey("type") ? response["type"].ToString() : "";

        if (responseType == "error")
        {
            LogError($"AI error: {response["message"]}");
            _gameState = GameState.HumanTurn;
            return;
        }

        // Handle game over from human's winning move
        if (responseType == "game_over")
        {
            int winner = Convert.ToInt32(response["winner"]);
            string winnerName = response.ContainsKey("winner_name") ? response["winner_name"].ToString() : "";
            
            EnqueueMainThread(() =>
            {
                _gameState = GameState.GameOver;
                string message = winner == 0 ? "Draw!" : (winner == _humanPlayer ? "You Win!" : "AI Wins!");
                Log($"Game over: {message}");
                OnGameOver?.Invoke(winner, message);
            });
            return;
        }

        // Handle AI move response
        if (responseType == "ai_move")
        {
            int aiPythonRow = Convert.ToInt32(response["row"]);
            int aiPythonCol = Convert.ToInt32(response["col"]);
            float thinkTime = response.ContainsKey("time") ? Convert.ToSingle(response["time"]) : 0f;
            bool gameOver = response.ContainsKey("game_over") && Convert.ToBoolean(response["game_over"]);

            // Convert Python coords back to Unity
            int unityCol = aiPythonCol;  // Python c -> Unity x
            int unityRow = aiPythonRow;  // Python r -> Unity z

            EnqueueMainThread(() =>
            {
                Log($"AI move: Python[row={aiPythonRow}, col={aiPythonCol}] -> Unity[col={unityCol}, row={unityRow}], time={thinkTime:F2}s");
                
                OnAIMoveReceived?.Invoke(unityCol, unityRow);
                
                // Make the AI move in Unity's GridManager
                MakeAIMoveInUnity(unityCol, unityRow);

                if (gameOver)
                {
                    int winner = Convert.ToInt32(response["winner"]);
                    _gameState = GameState.GameOver;
                    string message = winner == 0 ? "Draw!" : (winner == _humanPlayer ? "You Win!" : "AI Wins!");
                    OnGameOver?.Invoke(winner, message);
                }
                else
                {
                    // Switch to human's turn
                    _currentPlayer = _humanPlayer;
                    _gameState = GameState.HumanTurn;
                    OnHumanTurnStart?.Invoke();
                }
            });
        }
    }

    private async Task RequestAIFirstMove()
    {
        _aiThinkStartTime = Time.time;
        _thinkingProgressCoroutine = StartCoroutine(UpdateThinkingProgress());

        Log("Requesting AI first move...");

        var response = await SendMessageAsync(new { type = "ai_first" });

        if (_thinkingProgressCoroutine != null)
        {
            StopCoroutine(_thinkingProgressCoroutine);
            _thinkingProgressCoroutine = null;
        }

        if (response == null)
        {
            LogError("No response from AI server");
            return;
        }

        string responseType = response.ContainsKey("type") ? response["type"].ToString() : "";

        if (responseType == "ai_move")
        {
            int aiPythonRow = Convert.ToInt32(response["row"]);
            int aiPythonCol = Convert.ToInt32(response["col"]);
            float thinkTime = response.ContainsKey("time") ? Convert.ToSingle(response["time"]) : 0f;

            int unityCol = aiPythonCol;
            int unityRow = aiPythonRow;

            EnqueueMainThread(() =>
            {
                Log($"AI first move: Unity[col={unityCol}, row={unityRow}], time={thinkTime:F2}s");
                
                OnAIMoveReceived?.Invoke(unityCol, unityRow);
                MakeAIMoveInUnity(unityCol, unityRow);

                // Switch to human's turn
                _currentPlayer = _humanPlayer;
                _gameState = GameState.HumanTurn;
                OnHumanTurnStart?.Invoke();
            });
        }
    }

    private void MakeAIMoveInUnity(int unityCol, int unityRow)
    {
        if (gridManager == null)
        {
            LogError("GridManager not found!");
            return;
        }

        // GridManager.AttemptDrop expects (x, z, player) = (col, row, player)
        gridManager.AttemptDrop(unityCol, unityRow, _aiPlayer);
    }

    private IEnumerator UpdateThinkingProgress()
    {
        // Estimate thinking time based on difficulty
        float estimatedTime = (int)difficulty / 500f; // rough estimate: 1000 sims ~= 2 seconds
        
        while (true)
        {
            float elapsed = Time.time - _aiThinkStartTime;
            float progress = Mathf.Clamp01(elapsed / estimatedTime);
            OnAIThinkingProgress?.Invoke(progress);
            yield return new WaitForSeconds(0.1f);
        }
    }

    #endregion

    #region Private Methods - Networking

    private async Task<Dictionary<string, object>> SendMessageAsync(object message)
    {
        if (!_isConnected || _stream == null)
        {
            LogError("Not connected");
            return null;
        }

        try
        {
            string json = SerializeToJson(message);
            byte[] data = Encoding.UTF8.GetBytes(json + "\n");

            await _stream.WriteAsync(data, 0, data.Length);

            // Read response
            byte[] buffer = new byte[4096];
            StringBuilder responseBuilder = new StringBuilder();

            while (true)
            {
                int bytesRead = await _stream.ReadAsync(buffer, 0, buffer.Length);
                if (bytesRead == 0) break;

                string chunk = Encoding.UTF8.GetString(buffer, 0, bytesRead);
                responseBuilder.Append(chunk);

                if (chunk.Contains("\n")) break;
            }

            string response = responseBuilder.ToString().Trim();
            return DeserializeFromJson(response);
        }
        catch (Exception e)
        {
            LogError($"Network error: {e.Message}");
            _isConnected = false;
            return null;
        }
    }

    private void SendMessageSync(object message)
    {
        if (!_isConnected || _stream == null) return;

        try
        {
            string json = SerializeToJson(message);
            byte[] data = Encoding.UTF8.GetBytes(json + "\n");
            _stream.Write(data, 0, data.Length);
        }
        catch { }
    }

    private string SerializeToJson(object obj)
    {
        // Handle anonymous types
        if (obj.GetType().Name.Contains("AnonymousType"))
        {
            var sb = new StringBuilder("{");
            bool first = true;

            foreach (var prop in obj.GetType().GetProperties())
            {
                if (!first) sb.Append(",");
                first = false;

                string name = ToSnakeCase(prop.Name);
                object value = prop.GetValue(obj);

                sb.Append($"\"{name}\":");

                if (value is string s)
                    sb.Append($"\"{s}\"");
                else if (value is bool b)
                    sb.Append(b.ToString().ToLower());
                else if (value is int || value is float || value is double)
                    sb.Append(value);
                else
                    sb.Append($"\"{value}\"");
            }

            sb.Append("}");
            return sb.ToString();
        }

        return JsonUtility.ToJson(obj);
    }

    private string ToSnakeCase(string str)
    {
        var sb = new StringBuilder();
        for (int i = 0; i < str.Length; i++)
        {
            char c = str[i];
            if (char.IsUpper(c) && i > 0)
            {
                sb.Append('_');
            }
            sb.Append(char.ToLower(c));
        }
        return sb.ToString();
    }

    private Dictionary<string, object> DeserializeFromJson(string json)
    {
        var result = new Dictionary<string, object>();

        json = json.Trim();
        if (!json.StartsWith("{") || !json.EndsWith("}"))
            return result;

        json = json.Substring(1, json.Length - 2);
        var pairs = SplitJsonPairs(json);

        foreach (var pair in pairs)
        {
            int colonIdx = pair.IndexOf(':');
            if (colonIdx < 0) continue;

            string key = pair.Substring(0, colonIdx).Trim().Trim('"');
            string value = pair.Substring(colonIdx + 1).Trim();

            if (value.StartsWith("\"") && value.EndsWith("\""))
                result[key] = value.Substring(1, value.Length - 2);
            else if (value == "true")
                result[key] = true;
            else if (value == "false")
                result[key] = false;
            else if (value == "null")
                result[key] = null;
            else if (double.TryParse(value, System.Globalization.NumberStyles.Any, 
                     System.Globalization.CultureInfo.InvariantCulture, out double d))
                result[key] = d;
            else
                result[key] = value;
        }

        return result;
    }

    private List<string> SplitJsonPairs(string json)
    {
        var result = new List<string>();
        var current = new StringBuilder();
        int depth = 0;
        bool inString = false;

        foreach (char c in json)
        {
            if (c == '"' && (current.Length == 0 || current[current.Length - 1] != '\\'))
                inString = !inString;
            else if (!inString)
            {
                if (c == '{' || c == '[') depth++;
                else if (c == '}' || c == ']') depth--;
                else if (c == ',' && depth == 0)
                {
                    result.Add(current.ToString());
                    current.Clear();
                    continue;
                }
            }
            current.Append(c);
        }

        if (current.Length > 0)
            result.Add(current.ToString());

        return result;
    }

    private void EnqueueMainThread(Action action)
    {
        lock (_queueLock)
        {
            _mainThreadActions.Enqueue(action);
        }
    }

    #endregion

    #region Debug

    private void Log(string message)
    {
        if (enableDebugLogs)
            Debug.Log($"[AxialGame] {message}");
    }

    private void LogError(string message)
    {
        Debug.LogError($"[AxialGame] {message}");
    }

    #endregion
}

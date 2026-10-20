using UnityEngine;
using UnityEngine.UI;
using TMPro;
using System.Collections;

/// <summary>
/// Simple UI for displaying AI game status and controls.
/// Can be used with Unity UI or legacy GUI.
/// </summary>
public class AxialGameUI : MonoBehaviour
{
    #region Serialized Fields

    [Header("References")]
    [SerializeField] private AxialGameController gameController;

    [Header("UI Mode")]
    [SerializeField] private bool useUnityUI = false;  // Set to true if using Canvas UI

    [Header("Unity UI Elements (Optional)")]
    [SerializeField] private TextMeshProUGUI statusText;
    [SerializeField] private TextMeshProUGUI turnText;
    [SerializeField] private Button newGameButton;
    [SerializeField] private Button connectButton;
    [SerializeField] private TMP_Dropdown difficultyDropdown;
    [SerializeField] private Slider thinkingProgressBar;
    [SerializeField] private GameObject thinkingIndicator;

    [Header("Legacy GUI Settings")]
    [SerializeField] private bool showLegacyGUI = true;
    [SerializeField] private Vector2 guiPosition = new Vector2(10, 10);
    [SerializeField] private int fontSize = 16;

    [Header("Colors")]
    [SerializeField] private Color connectedColor = Color.green;
    [SerializeField] private Color disconnectedColor = Color.red;
    [SerializeField] private Color humanTurnColor = Color.cyan;
    [SerializeField] private Color aiTurnColor = Color.yellow;
    [SerializeField] private Color gameOverColor = Color.magenta;

    #endregion

    #region Private Fields

    private string _statusMessage = "Not Connected";
    private string _turnMessage = "";
    private string _gameOverMessage = "";
    private float _thinkingProgress = 0f;
    private bool _isAIThinking = false;
    private GUIStyle _boxStyle;
    private GUIStyle _labelStyle;
    private GUIStyle _buttonStyle;

    #endregion

    #region Unity Lifecycle

    private void Start()
    {
        if (gameController == null)
            gameController = FindAnyObjectByType<AxialGameController>();

        if (gameController != null)
        {
            // Subscribe to events
            gameController.OnConnected.AddListener(HandleConnected);
            gameController.OnDisconnected.AddListener(HandleDisconnected);
            gameController.OnConnectionError.AddListener(HandleConnectionError);
            gameController.OnGameStarted.AddListener(HandleGameStarted);
            gameController.OnHumanTurnStart.AddListener(HandleHumanTurn);
            gameController.OnAIThinkingStart.AddListener(HandleAIThinking);
            gameController.OnAIThinkingProgress.AddListener(HandleThinkingProgress);
            gameController.OnAIMoveReceived.AddListener(HandleAIMove);
            gameController.OnGameOver.AddListener(HandleGameOver);
        }

        // Setup Unity UI if available
        SetupUnityUI();
    }

    private void OnDestroy()
    {
        if (gameController != null)
        {
            gameController.OnConnected.RemoveListener(HandleConnected);
            gameController.OnDisconnected.RemoveListener(HandleDisconnected);
            gameController.OnConnectionError.RemoveListener(HandleConnectionError);
            gameController.OnGameStarted.RemoveListener(HandleGameStarted);
            gameController.OnHumanTurnStart.RemoveListener(HandleHumanTurn);
            gameController.OnAIThinkingStart.RemoveListener(HandleAIThinking);
            gameController.OnAIThinkingProgress.RemoveListener(HandleThinkingProgress);
            gameController.OnAIMoveReceived.RemoveListener(HandleAIMove);
            gameController.OnGameOver.RemoveListener(HandleGameOver);
        }
    }

    private void OnGUI()
    {
        if (!showLegacyGUI || useUnityUI) return;

        InitGUIStyles();
        DrawLegacyGUI();
    }

    #endregion

    #region Unity UI Setup

    private void SetupUnityUI()
    {
        if (!useUnityUI) return;

        if (newGameButton != null)
        {
            newGameButton.onClick.AddListener(() => gameController?.NewGame());
        }

        if (connectButton != null)
        {
            connectButton.onClick.AddListener(() => gameController?.ConnectAndStartGame());
        }

        if (difficultyDropdown != null)
        {
            difficultyDropdown.onValueChanged.AddListener(OnDifficultyChanged);
        }

        UpdateUnityUI();
    }

    private void UpdateUnityUI()
    {
        if (!useUnityUI) return;

        if (statusText != null)
            statusText.text = _statusMessage;

        if (turnText != null)
        {
            if (!string.IsNullOrEmpty(_gameOverMessage))
                turnText.text = _gameOverMessage;
            else
                turnText.text = _turnMessage;
        }

        if (thinkingProgressBar != null)
        {
            thinkingProgressBar.gameObject.SetActive(_isAIThinking);
            thinkingProgressBar.value = _thinkingProgress;
        }

        if (thinkingIndicator != null)
            thinkingIndicator.SetActive(_isAIThinking);
    }

    private void OnDifficultyChanged(int index)
    {
        if (gameController == null) return;

        switch (index)
        {
            case 0: gameController.SetDifficulty(AxialGameController.Difficulty.Easy); break;
            case 1: gameController.SetDifficulty(AxialGameController.Difficulty.Medium); break;
            case 2: gameController.SetDifficulty(AxialGameController.Difficulty.Hard); break;
            case 3: gameController.SetDifficulty(AxialGameController.Difficulty.Nightmare); break;
        }
    }

    #endregion

    #region Legacy GUI

    private void InitGUIStyles()
    {
        if (_boxStyle != null) return;

        _boxStyle = new GUIStyle(GUI.skin.box)
        {
            padding = new RectOffset(10, 10, 10, 10)
        };

        _labelStyle = new GUIStyle(GUI.skin.label)
        {
            fontSize = fontSize,
            wordWrap = true
        };

        _buttonStyle = new GUIStyle(GUI.skin.button)
        {
            fontSize = fontSize
        };
    }

    private void DrawLegacyGUI()
    {
        float width = 250;
        float height = 200;

        GUILayout.BeginArea(new Rect(guiPosition.x, guiPosition.y, width, height), _boxStyle);

        // Title
        GUILayout.Label("AXIAL AI", new GUIStyle(_labelStyle) { fontStyle = FontStyle.Bold, fontSize = fontSize + 4 });
        GUILayout.Space(5);

        // Connection Status
        Color prevColor = GUI.color;
        GUI.color = gameController != null && gameController.IsConnected ? connectedColor : disconnectedColor;
        GUILayout.Label(_statusMessage, _labelStyle);
        GUI.color = prevColor;

        GUILayout.Space(5);

        // Turn/Game Status
        if (!string.IsNullOrEmpty(_gameOverMessage))
        {
            GUI.color = gameOverColor;
            GUILayout.Label(_gameOverMessage, _labelStyle);
            GUI.color = prevColor;
        }
        else if (!string.IsNullOrEmpty(_turnMessage))
        {
            GUI.color = _isAIThinking ? aiTurnColor : humanTurnColor;
            GUILayout.Label(_turnMessage, _labelStyle);
            GUI.color = prevColor;

            // Thinking progress
            if (_isAIThinking)
            {
                GUILayout.Space(5);
                Rect progressRect = GUILayoutUtility.GetRect(width - 20, 20);
                GUI.Box(progressRect, "");
                GUI.color = aiTurnColor;
                GUI.Box(new Rect(progressRect.x, progressRect.y, progressRect.width * _thinkingProgress, progressRect.height), "");
                GUI.color = prevColor;
            }
        }

        GUILayout.FlexibleSpace();

        // Difficulty selector
        GUILayout.BeginHorizontal();
        GUILayout.Label("Difficulty:", _labelStyle, GUILayout.Width(70));
        
        string currentDiff = gameController?.CurrentDifficulty.ToString() ?? "Hard";
        if (GUILayout.Button(currentDiff, _buttonStyle, GUILayout.Width(80)))
        {
            CycleDifficulty();
        }
        GUILayout.EndHorizontal();

        GUILayout.Space(5);

        // Buttons
        if (gameController != null)
        {
            if (!gameController.IsConnected)
            {
                if (GUILayout.Button("Connect", _buttonStyle))
                {
                    gameController.ConnectAndStartGame();
                }
            }
            else
            {
                if (GUILayout.Button("New Game", _buttonStyle))
                {
                    gameController.NewGame();
                }
            }
        }

        GUILayout.EndArea();
    }

    private void CycleDifficulty()
    {
        if (gameController == null) return;

        var current = gameController.CurrentDifficulty;
        switch (current)
        {
            case AxialGameController.Difficulty.Easy:
                gameController.SetDifficulty(AxialGameController.Difficulty.Medium);
                break;
            case AxialGameController.Difficulty.Medium:
                gameController.SetDifficulty(AxialGameController.Difficulty.Hard);
                break;
            case AxialGameController.Difficulty.Hard:
                gameController.SetDifficulty(AxialGameController.Difficulty.Nightmare);
                break;
            case AxialGameController.Difficulty.Nightmare:
                gameController.SetDifficulty(AxialGameController.Difficulty.Easy);
                break;
        }
    }

    #endregion

    #region Event Handlers

    private void HandleConnected()
    {
        _statusMessage = "Connected to AI Server";
        _gameOverMessage = "";
        UpdateUnityUI();
    }

    private void HandleDisconnected()
    {
        _statusMessage = "Disconnected";
        _turnMessage = "";
        _isAIThinking = false;
        UpdateUnityUI();
    }

    private void HandleConnectionError(string error)
    {
        _statusMessage = $"Connection Error: {error}";
        UpdateUnityUI();
    }

    private void HandleGameStarted()
    {
        _gameOverMessage = "";
        _turnMessage = "Game Started!";
        UpdateUnityUI();
    }

    private void HandleHumanTurn()
    {
        _turnMessage = "Your Turn - Drop a piece!";
        _isAIThinking = false;
        _thinkingProgress = 0f;
        UpdateUnityUI();
    }

    private void HandleAIThinking()
    {
        _turnMessage = "AI is thinking...";
        _isAIThinking = true;
        _thinkingProgress = 0f;
        UpdateUnityUI();
    }

    private void HandleThinkingProgress(float progress)
    {
        _thinkingProgress = progress;
        UpdateUnityUI();
    }

    private void HandleAIMove(int col, int row)
    {
        _isAIThinking = false;
        _thinkingProgress = 0f;
        // Brief message - will be overwritten by HandleHumanTurn
        _turnMessage = $"AI played at ({col}, {row})";
        UpdateUnityUI();
    }

    private void HandleGameOver(int winner, string message)
    {
        _gameOverMessage = message;
        _turnMessage = "";
        _isAIThinking = false;
        UpdateUnityUI();
    }

    #endregion
}

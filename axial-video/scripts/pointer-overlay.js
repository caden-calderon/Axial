// Injected before page scripts: headless Chrome draws no cursor, so recordings get one here.
// Mouse: an arrow that follows pointer events, with a ring on press. Touch: a fingertip marker
// driven by the recorder (window.__axialPointer). Animations run on the page's virtual clock.
(() => {
  const style = `
		#__axial-pointer { position: fixed; left: 0; top: 0; z-index: 2147483647; pointer-events: none;
			width: 0; height: 0; transform: translate(-200px, -200px); }
		#__axial-pointer svg { position: absolute; left: -3px; top: -2px; width: 26px; height: 26px;
			filter: drop-shadow(0 2px 3px rgb(0 0 0 / 0.45)); }
		#__axial-pointer .ring { position: absolute; left: -18px; top: -18px; width: 36px; height: 36px;
			border-radius: 50%; border: 2px solid rgb(255 255 255 / 0.85); opacity: 0; }
		#__axial-pointer.pressed .ring { animation: __axial-press 380ms ease-out forwards; }
		@keyframes __axial-press { from { transform: scale(0.35); opacity: 0.9; } to { transform: scale(1); opacity: 0; } }
		#__axial-pointer.touch svg { display: none; }
		#__axial-pointer .finger { position: absolute; left: -24px; top: -24px; width: 48px; height: 48px;
			border-radius: 50%; background: rgb(255 255 255 / 0.28); border: 2px solid rgb(255 255 255 / 0.8);
			box-shadow: 0 2px 10px rgb(0 0 0 / 0.35); opacity: 0; transform: scale(0.7);
			transition: opacity 140ms ease, transform 140ms ease; }
		#__axial-pointer.touching .finger { opacity: 1; transform: scale(1); }
	`;
  const arrow = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 2.5v17.2l4.6-4.3 2.9 6.6 3-1.3-2.9-6.5h6.3z"
		fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg>`;

  let element = null;
  const mount = () => {
    if (element) return;
    const sheet = document.createElement("style");
    sheet.textContent = style;
    document.head.append(sheet);
    element = document.createElement("div");
    element.id = "__axial-pointer";
    element.innerHTML = `${arrow}<div class="ring"></div><div class="finger"></div>`;
    document.body.append(element);
  };
  const place = (x, y) => {
    mount();
    element.style.transform = `translate(${x}px, ${y}px)`;
  };
  const press = () => {
    mount();
    element.classList.remove("pressed");
    void element.offsetWidth; // restart the ring animation
    element.classList.add("pressed");
  };

  window.addEventListener(
    "pointermove",
    (event) => {
      if (event.pointerType === "mouse") place(event.clientX, event.clientY);
    },
    true,
  );
  window.addEventListener(
    "pointerdown",
    (event) => {
      if (event.pointerType === "mouse") press();
    },
    true,
  );

  window.__axialPointer = {
    touchStart(x, y) {
      place(x, y);
      element.classList.add("touch", "touching");
    },
    touchMove(x, y) {
      place(x, y);
      element.classList.add("touch");
    },
    touchEnd() {
      element?.classList.remove("touching");
    },
  };
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", mount);
  else mount();
})();

export default async function ({ addon, console, msg }) {
  await addon.tab.loadScript("/libraries/thirdparty/cs/tinycolor-min.js");

  const CONTAINER_WIDTH = 150;
  const HANDLE_WIDTH = 26;
  let prevEventHandler;
  let handleClickOffset;
  let element;
  let labelReadout;
  let saOpacityHandle;
  let saOpacitySlider;
  let saOpacitySliderBg;
  let inputOpacity;

  const getColor = () => {
    let fillOrStroke;
    const state = addon.tab.redux.state;
    if (state.scratchPaint.modals.fillColor) {
      fillOrStroke = "fill";
    } else if (state.scratchPaint.modals.strokeColor) {
      fillOrStroke = "stroke";
    } else {
      return;
    }
    const colorType = state.scratchPaint.fillMode.colorIndex;
    const primaryOrSecondary = ["primary", "secondary"][colorType];
    const color = state.scratchPaint.color[`${fillOrStroke}Color`][primaryOrSecondary];
    if (color === null || color === "scratch-paint/style-path/mixed") return;
    return tinycolor(color).toRgbString();
  };

  const setColor = (color) => {
    const onEyeDropperOpened = ({ detail }) => {
      if (detail.action.type !== "scratch-paint/eye-dropper/ACTIVATE_COLOR_PICKER") return;
      addon.tab.redux.removeEventListener("statechanged", onEyeDropperOpened);
      const previousTool = addon.tab.redux.state.scratchPaint.color.eyeDropper.previousTool;
      if (previousTool) previousTool.activate();
      addon.tab.redux.state.scratchPaint.color.eyeDropper.callback(color);
      addon.tab.redux.dispatch({
        type: "scratch-paint/eye-dropper/DEACTIVATE_COLOR_PICKER",
      });
    };
    addon.tab.redux.addEventListener("statechanged", onEyeDropperOpened);
    element.children[1].children[0].click();
  };

  const setSliderBg = (color) => {
    const hex = tinycolor(color).toHexString(); // remove alpha value
    saOpacitySliderBg.style.background = `linear-gradient(to left, ${hex} 0%, rgba(0, 0, 0, 0) 100%)`;
  };

  const getEventXY = (e) => {
    if (e.touches && e.touches[0]) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.changedTouches && e.changedTouches[0]) {
      return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
  };

  const handleMouseDown = (event) => {
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    handleClickOffset = getEventXY(event).x - saOpacityHandle.getBoundingClientRect().left;
  };

  const handleMouseUp = () => {
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
  };

  const handleMouseMove = (event) => {
    event.preventDefault();
    changeOpacity(scaleMouseToSliderPosition(event));
  };

  const handleClickBackground = (event) => {
    handleClickOffset = HANDLE_WIDTH / 2;
    changeOpacity(scaleMouseToSliderPosition(event));
  };

  const scaleMouseToSliderPosition = (event) => {
    const { x } = getEventXY(event);
    const backgroundBBox = saOpacitySlider.getBoundingClientRect();
    const scaledX = x - backgroundBBox.left - handleClickOffset;
    return Math.max(0, Math.min(100, (100 * scaledX) / (backgroundBBox.width - HANDLE_WIDTH)));
  };

  const changeOpacity = (opacityValue) => {
    const halfHandleWidth = HANDLE_WIDTH / 2;
    const pixelMin = halfHandleWidth;
    const pixelMax = CONTAINER_WIDTH - halfHandleWidth;
    labelReadout.textContent = Math.round(opacityValue);
    saOpacityHandle.style.left = pixelMin + (pixelMax - pixelMin) * (opacityValue / 100) - halfHandleWidth + "px";

    const color = tinycolor(getColor()).toRgb();
    scratchAddons.opacitySliderAlpha = opacityValue / 100;
    setColor(`rgba(${color.r}, ${color.g}, ${color.b}, ${opacityValue / 100})`);

    // Update the input value when the slider changes
    inputOpacity.value = Math.round(opacityValue);
  };

  const setHandlePos = (alphaValue) => {
    saOpacityHandle.style.left = alphaValue * (CONTAINER_WIDTH - HANDLE_WIDTH) + "px";
  };

  while (true) {
    element = await addon.tab.waitForElement('div[class*="color-picker_swatch-row"]', {
      markAsSeen: true,
      reduxCondition: (state) =>
        state.scratchGui.editorTab.activeTabIndex === 1 &&
        !state.scratchGui.mode.isPlayerOnly &&
        state.scratchPaint.selectedItems.length > 0,
    });
    addon.tab.redux.initialize();
    if (typeof prevEventHandler === "function") {
      addon.tab.redux.removeEventListener("statechanged", prevEventHandler);
      prevEventHandler = null;
    }

    const containerWrapper = document.createElement("div");
    const rowHeader = Object.assign(document.createElement("div"), {
      className: addon.tab.scratchClass("color-picker_row-header"),
    });

    const saLabelName = Object.assign(document.createElement("span"), {
      className: addon.tab.scratchClass("color-picker_label-name"),
      textContent: msg("opacity"),
    });

    const defaultAlpha = tinycolor(getColor()).toRgb().a;
    labelReadout = Object.assign(document.createElement("span"), {
      className: addon.tab.scratchClass("color-picker_label-readout"),
    });
    labelReadout.textContent = Math.round(defaultAlpha * 100);

    const defaultColor = getColor();
    saOpacitySlider = Object.assign(document.createElement("div"), {
      className: `sa-opacity-slider ${addon.tab.scratchClass("slider_container", "slider_last")}`,
    });
    saOpacitySlider.addEventListener("click", handleClickBackground);

    saOpacitySliderBg = Object.assign(document.createElement("div"), {
      className: "sa-opacity-slider-bg",
    });
    setSliderBg(defaultColor);

    saOpacityHandle = Object.assign(document.createElement("div"), {
      className: `sa-opacity-handle ${addon.tab.scratchClass("slider_handle")}`,
    });
    saOpacityHandle.addEventListener("mousedown", handleMouseDown);
    saOpacityHandle.addEventListener("click", (event) => event.stopPropagation());

    // Add number input for opacity
    inputOpacity = document.createElement("input");
    inputOpacity.type = "number";
    inputOpacity.min = 0;
    inputOpacity.max = 100;
    inputOpacity.value = Math.round(defaultAlpha * 100);
    inputOpacity.style.width = "50px";
    inputOpacity.style.marginLeft = "10px";
    inputOpacity.className = addon.tab.scratchClass("input_input-small");
    inputOpacity.addEventListener("input", () => {
      const value = Math.max(0, Math.min(100, inputOpacity.value));
      changeOpacity(value);
    });

    const lastSlider = document.querySelector('[class*="slider_last"]');
    lastSlider.className = addon.tab.scratchClass("slider_container");
    setHandlePos(defaultAlpha);
    scratchAddons.opacitySliderAlpha = defaultAlpha;

    prevEventHandler = ({ detail }) => {
      if (
        detail.action.type === "scratch-paint/fill-style/CHANGE_FILL_COLOR" ||
        detail.action.type === "scratch-paint/fill-style/CHANGE_FILL_COLOR_2" ||
        detail.action.type === "scratch-paint/stroke-style/CHANGE_STROKE_COLOR" ||
        detail.action.type === "scratch-paint/stroke-style/CHANGE_STROKE_COLOR_2" ||
        detail.action.type === "scratch-paint/color-index/CHANGE_COLOR_INDEX"
      ) {
        const color = getColor();
        setSliderBg(color);
        if (detail.action.type === "scratch-paint/color-index/CHANGE_COLOR_INDEX") {
          labelReadout.textContent = Math.round(tinycolor(color).toRgb().a * 100);
          setHandlePos(tinycolor(color).toRgb().a);
        }
      }
    };
    addon.tab.redux.addEventListener("statechanged", prevEventHandler);

    if (addon.tab.redux.state.scratchPaint.format.startsWith("BITMAP")) continue;

    containerWrapper.appendChild(rowHeader);
    containerWrapper.appendChild(saOpacitySlider);
    rowHeader.appendChild(saLabelName);
    rowHeader.appendChild(labelReadout);
    saOpacitySlider.appendChild(saOpacitySliderBg);
    saOpacitySlider.appendChild(saOpacityHandle);

    // Append the number input next to the slider
    containerWrapper.appendChild(inputOpacity);

    element.children[1].appendChild(containerWrapper);
  }
}

import { Dialog } from "siyuan";

interface ZoomState {
  scale: number;
  translateX: number;
  translateY: number;
  isDragging: boolean;
  startX: number;
  startY: number;
}

/**
 * 打开全屏放大预览弹窗
 */
export function openZoomDialog(svgElement: SVGElement, i18n: Record<string, string>) {
  // 记录原始 SVG 的渲染尺寸
  const svgRect = svgElement.getBoundingClientRect();

  // 克隆 SVG
  const svgClone = svgElement.cloneNode(true) as SVGElement;

  // 在修改前序列化 SVG（用于导出，保持原始干净状态）
  // 确保 SVG 有显式的像素尺寸，供 Image 加载时使用
  const exportClone = svgElement.cloneNode(true) as SVGElement;
  if (!exportClone.getAttribute("width") || exportClone.getAttribute("width")?.includes("%")) {
    exportClone.setAttribute("width", String(Math.round(svgRect.width)));
  }
  if (!exportClone.getAttribute("height") || exportClone.getAttribute("height")?.includes("%")) {
    exportClone.setAttribute("height", String(Math.round(svgRect.height)));
  }
  const svgForExport = new XMLSerializer().serializeToString(exportClone);

  // 移除可能的尺寸限制，使其可自由缩放（仅影响预览）
  svgClone.removeAttribute("width");
  svgClone.removeAttribute("height");
  svgClone.style.width = "auto";
  svgClone.style.height = "auto";
  svgClone.style.maxWidth = "none";
  svgClone.style.maxHeight = "none";

  // 创建弹窗
  const dialog = new Dialog({
    title: i18n.previewTitle || "Diagram Preview",
    content: `
      <div class="mermaid-zoom-overlay">
        <div class="mermaid-zoom-toolbar">
          <button class="toolbar-btn" data-action="zoom-in" title="${i18n.zoomIn}">
            <svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
            ${i18n.zoomIn}
          </button>
          <button class="toolbar-btn" data-action="zoom-out" title="${i18n.zoomOut}">
            <svg viewBox="0 0 24 24"><path d="M19 13H5v-2h14v2z"/></svg>
            ${i18n.zoomOut}
          </button>
          <span class="zoom-level">100%</span>
          <button class="toolbar-btn" data-action="reset" title="${i18n.resetZoom}">
            <svg viewBox="0 0 24 24"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>
            ${i18n.resetZoom}
          </button>
          <div class="toolbar-separator"></div>
          <select class="toolbar-select" id="export-format">
            <option value="svg">SVG</option>
            <option value="png" selected>PNG</option>
            <option value="jpg">JPG</option>
          </select>
          <select class="toolbar-select" id="export-scale">
            <option value="1">1×</option>
            <option value="2" selected>2×</option>
            <option value="3">3×</option>
            <option value="4">4×</option>
          </select>
          <button class="toolbar-btn" data-action="download" title="${i18n.download}">
            <svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
            ${i18n.download}
          </button>
        </div>
        <div class="mermaid-zoom-container">
          <div class="mermaid-zoom-svg-wrapper"></div>
        </div>
      </div>
    `,
    width: "90vw",
    height: "85vh",
  });

  // 将 SVG 放入容器
  const wrapper = dialog.element.querySelector(".mermaid-zoom-svg-wrapper") as HTMLElement;
  const container = dialog.element.querySelector(".mermaid-zoom-container") as HTMLElement;
  const zoomLevelEl = dialog.element.querySelector(".zoom-level") as HTMLElement;
  wrapper.appendChild(svgClone);

  // 缩放/拖拽状态
  const state: ZoomState = {
    scale: 1,
    translateX: 0,
    translateY: 0,
    isDragging: false,
    startX: 0,
    startY: 0,
  };

  // ---- 更新变换 ----
  function applyTransform() {
    wrapper.style.transform = `translate(${state.translateX}px, ${state.translateY}px) scale(${state.scale})`;
    zoomLevelEl.textContent = `${Math.round(state.scale * 100)}%`;
  }

  // ---- 缩放 ----
  function zoom(delta: number, centerX?: number, centerY?: number) {
    const oldScale = state.scale;
    state.scale = Math.max(0.1, Math.min(10, state.scale + delta));

    // 如果提供了缩放中心点，保持该点位置不变
    if (centerX !== undefined && centerY !== undefined) {
      const rect = container.getBoundingClientRect();
      const offsetX = centerX - rect.left - rect.width / 2;
      const offsetY = centerY - rect.top - rect.height / 2;
      const ratio = 1 - state.scale / oldScale;
      state.translateX += (offsetX - state.translateX) * ratio;
      state.translateY += (offsetY - state.translateY) * ratio;
    }

    applyTransform();
  }

  // ---- 鼠标滚轮缩放 ----
  container.addEventListener("wheel", (e: WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    zoom(delta, e.clientX, e.clientY);
  }, { passive: false });

  // ---- 拖拽平移 ----
  container.addEventListener("mousedown", (e: MouseEvent) => {
    if (e.button !== 0) return; // 只响应左键
    state.isDragging = true;
    state.startX = e.clientX - state.translateX;
    state.startY = e.clientY - state.translateY;
    container.classList.add("is-grabbing");
    e.preventDefault();
  });

  const handleMouseMove = (e: MouseEvent) => {
    if (!state.isDragging) return;
    state.translateX = e.clientX - state.startX;
    state.translateY = e.clientY - state.startY;
    applyTransform();
  };

  const handleMouseUp = () => {
    state.isDragging = false;
    container.classList.remove("is-grabbing");
  };

  // 监听 document 级别以处理鼠标移出容器的情况
  document.addEventListener("mousemove", handleMouseMove);
  document.addEventListener("mouseup", handleMouseUp);

  // ---- 导出控件 ----
  const formatSelect = dialog.element.querySelector("#export-format") as HTMLSelectElement;
  const scaleSelect = dialog.element.querySelector("#export-scale") as HTMLSelectElement;

  // 格式切换时，SVG 隐藏倍率选择器
  formatSelect.addEventListener("change", () => {
    scaleSelect.style.display = formatSelect.value === "svg" ? "none" : "";
  });

  // ---- 工具栏按钮 ----
  dialog.element.querySelectorAll(".toolbar-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const action = (btn as HTMLElement).dataset.action;
      switch (action) {
        case "zoom-in":
          zoom(0.2);
          break;
        case "zoom-out":
          zoom(-0.2);
          break;
        case "reset":
          state.scale = 1;
          state.translateX = 0;
          state.translateY = 0;
          applyTransform();
          break;
        case "download": {
          const format = formatSelect.value as "svg" | "png" | "jpg";
          const scale = Number(scaleSelect.value);
          if (format === "svg") {
            exportSvg(svgForExport);
          } else {
            exportRaster(svgForExport, svgRect.width, svgRect.height, format, scale);
          }
          break;
        }
      }
    });
  });

  // ---- ESC 关闭弹窗 ----
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      dialog.destroy();
    }
  };
  document.addEventListener("keydown", handleKeyDown, true);

  // ---- 弹窗销毁时清理 ----
  const originalDestroy = dialog.destroy.bind(dialog);
  dialog.destroy = (options?: any) => {
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
    document.removeEventListener("keydown", handleKeyDown, true);
    originalDestroy(options);
  };
}

/**
 * 直接下载 SVG 文件
 */
function exportSvg(svgData: string) {
  const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `diagram-${Date.now()}.svg`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * 将 SVG 导出为 PNG 或 JPG
 */
function exportRaster(
  svgData: string,
  width: number,
  height: number,
  format: "png" | "jpg",
  scale: number
) {
  // 使用 data URL 避免 canvas 被污染
  const base64 = btoa(unescape(encodeURIComponent(svgData)));
  const dataUrl = `data:image/svg+xml;base64,${base64}`;

  const img = new Image();
  img.onerror = (e) => {
    console.error("[mermaid-zoom] Failed to load SVG as image:", e);
  };
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = img.width * scale;
    canvas.height = img.height * scale;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // JPG 不支持透明，填白底
    if (format === "jpg") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0);

    const mimeType = format === "jpg" ? "image/jpeg" : "image/png";
    canvas.toBlob((blob) => {
      if (!blob) {
        console.error("[mermaid-zoom] canvas.toBlob returned null");
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `diagram-${Date.now()}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    }, mimeType);
  };
  img.src = dataUrl;
}

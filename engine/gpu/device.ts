export interface GPUState {
  device: GPUDevice;
  context: GPUCanvasContext;
  format: GPUTextureFormat;
}

export async function initWebGPU(canvas: HTMLCanvasElement): Promise<GPUState> {
  if (!navigator.gpu) {
    throw new Error(
      "WebGPU is not supported on this browser. Please use Chrome/Edge or enable flags.",
    );
  }

  const adapter = await navigator.gpu.requestAdapter();

  if (!adapter) {
    throw new Error("No appropriate GPU Adapter found.");
  }

  const device = await adapter.requestDevice();
  const context = canvas.getContext("webgpu") as GPUCanvasContext;
  const format = navigator.gpu.getPreferredCanvasFormat();

  context.configure({
    device,
    format,
    alphaMode: "premultiplied",
  });

  return { device, context, format };
}

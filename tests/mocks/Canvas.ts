class MockCanvasRenderingContext2D {
  createImageData() {
    return {
      data: [],
    };
  }
  putImageData() {}
}

class MockCanvasElement {
  getContext() {
    return new MockCanvasRenderingContext2D();
  }
}

export default MockCanvasElement as unknown as typeof HTMLCanvasElement;

class BlankCanvasElement {
  getContext() {
    return null;
  }
}

export const BlankCanvas = BlankCanvasElement as unknown as typeof HTMLCanvasElement;

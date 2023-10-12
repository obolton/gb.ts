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

// Allow JSX usage of Media Chrome custom elements in TypeScript
declare namespace JSX {
  interface IntrinsicElements {
    'media-controller': any;
    'media-progress-range': any;
    'media-time-range': any;
  }
}

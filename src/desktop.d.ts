interface Window {
  readonly experienceAGBDesktop?: {
    onAIConfigurationChanged(callback: () => void): () => void;
  };
}

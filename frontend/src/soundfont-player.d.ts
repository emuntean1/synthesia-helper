declare module "soundfont-player" {
  interface Player {
    play(
      note: string,
      time?: number,
      options?: { duration?: number; gain?: number }
    ): { stop: (time?: number) => void };
    stop(time?: number): void;
    schedule(
      time: number,
      events: Array<{ note: string; time: number; duration?: number; gain?: number }>
    ): void;
  }

  function instrument(
    ac: AudioContext,
    name: string,
    options?: {
      soundfont?: string;
      format?: string;
      destination?: AudioNode;
      gain?: number;
    }
  ): Promise<Player>;
}

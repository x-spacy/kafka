declare module '@x-spacy/kafka' {
  export class KafkaProvider {
    public async publish(topic: string, buffer: Buffer, partition?: number | null | undefined): Promise<void>;
  }
}

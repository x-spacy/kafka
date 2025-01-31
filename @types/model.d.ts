declare module '@x-spacy/kafka/models/KafkaMessage' {
  import { Message } from '@confluentinc/kafka-javascript';

  export interface KafkaMessage extends Message {
    ack: () => void;
  }
}

declare module '@x-spacy/kafka' {
  export type KafkaServerProperties = {
    host: string;
    port: number;
    username: string;
    password: string;
    groupId: string;
  }
  export class KafkaModule {
    public static forRoot(config: KafkaServerProperties): DynamicModule;

    public static subscribe(...topics: string[]): DynamicModule;
  }
}

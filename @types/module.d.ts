declare module '@x-spacy/kafka' {
  export type KafkaServerProperties = {
    host: string;
    port: number;
    username: string;
    password: string;
    securityProtocol: 'plaintext' | 'ssl' | 'sasl_plaintext' | 'sasl_ssl' | undefined;
    mechanism: string;
    groupId: string;
  }
  export class KafkaModule {
    public static forRoot(config: KafkaServerProperties): DynamicModule;

    public static subscribe(...topics: string[]): DynamicModule;
  }
}

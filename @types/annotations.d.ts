declare module '@x-spacy/kafka' {
  /**
   * @param topicName string
   * @deprecated Use @Subscriber instead
   */
  export declare function MessageListener(topicName: string): ClassDecorator;
  export declare function Subscriber(topicName: string): ClassDecorator;
}

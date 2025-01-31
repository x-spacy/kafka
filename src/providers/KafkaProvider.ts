import {
  Injectable,
  Logger,
  Type
} from '@nestjs/common';
import { DiscoveryService, Reflector } from '@nestjs/core';
import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';

import {
  KafkaConsumer,
  Producer as KafkaProducer,
  Message
} from '@confluentinc/kafka-javascript';

@Injectable()
export class KafkaProvider {
  private readonly discoveryService: DiscoveryService;
  private readonly reflector: Reflector;

  private readonly kafkaConsumer: KafkaConsumer;
  private readonly kafkaProducer: KafkaProducer;

  private readonly topicListeners: Map<string, InstanceWrapper<Function | Type<unknown>>> = new Map();

  private readonly AWAITING_PUBLISH_MESSAGES = new Map<string, { buffer: Buffer, partition: number | null | undefined }>();

  constructor(host: string, port: number, username: string, password: string, groupId: string) {
    this.kafkaConsumer = new KafkaConsumer({
      'bootstrap.servers': `${host}:${port}`,
      'security.protocol': 'sasl_plaintext',
      'sasl.mechanisms': 'PLAIN',
      'sasl.username': username,
      'sasl.password': password,
      'group.id': groupId,
      'auto.offset.reset': 'earliest',
      'enable.auto.commit': false
    }).connect();

    this.kafkaConsumer.on('ready', () => {
      this.kafkaConsumer.consume();
    });

    this.kafkaConsumer.on('event.error', (error) => {
      Logger.error(error, KafkaProvider.name);
    });

    this.kafkaProducer = new KafkaProducer({
      'bootstrap.servers': `${host}:${port}`,
      'security.protocol': 'sasl_plaintext',
      'sasl.mechanisms': 'PLAIN',
      'sasl.username': username,
      'sasl.password': password
    }).connect();

    this.kafkaProducer.on('ready', () => {
      if (this.AWAITING_PUBLISH_MESSAGES.size <= 0) {
        return;
      }

      for (const [ topic, message ] of this.AWAITING_PUBLISH_MESSAGES) {
        const { buffer, partition } = message;

        this.kafkaProducer.produce(topic, partition, buffer);
      }
    });

    this.kafkaProducer.on('event.error', (error) => {
      Logger.error(error, KafkaProvider.name);
    });
  }

  public async subscribe(...topics: string[]): Promise<void> {
    this.kafkaConsumer.subscribe(topics);

    this.discoveryService.getProviders().forEach((provider: InstanceWrapper<Type<unknown> | Function>) => {
      const instance = !provider.metatype || provider.inject ? provider.instance?.constructor : provider.metatype;

      if (!instance) {
        return;
      }

      const topicName = this.reflector.get('x-spacy:on_message_event_metadata', instance);

      if (!topics.includes(topicName)) {
        return;
      }

      this.topicListeners.set(topicName, provider);
    });

    this.kafkaConsumer.on('data', async (message: Message) => {
      const topicName = message.topic;

      if (!this.topicListeners.has(topicName)) {
        return;
      }

      const messageListener = this.topicListeners.get(topicName)?.instance;

      if (!messageListener) {
        return;
      }

      const method = Reflect.get(messageListener, 'onMessage');

      if (!method) {
        return;
      }

      method.call(messageListener, message);
    });
  }

  public async publish(topic: string, buffer: Buffer, partition?: number | null | undefined): Promise<void> {
    if (!this.kafkaProducer.isConnected()) {
      this.AWAITING_PUBLISH_MESSAGES.set(topic, { buffer, partition });

      return;
    }

    this.kafkaProducer.produce(topic, partition, buffer);
  }
}

import {
  Injectable,
  Logger,
  OnModuleInit,
  Type
} from '@nestjs/common';
import { DiscoveryService, Reflector } from '@nestjs/core';
import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';

import {
  KafkaConsumer,
  Producer as KafkaProducer,
  Message
} from '@confluentinc/kafka-javascript';

import { KafkaMessage } from '@x-spacy/kafka/models/KafkaMessage';

@Injectable()
export class KafkaProvider implements OnModuleInit {
  private readonly discoveryService: DiscoveryService;

  private readonly reflector: Reflector;

  private readonly kafkaConsumer: KafkaConsumer;

  private readonly kafkaProducer: KafkaProducer;

  private readonly topicListeners: Map<string, InstanceWrapper<Function | Type<unknown>>> = new Map();

  private readonly AWAITING_SUBSCRIPTIONS = new Array<string>();

  private readonly AWAITING_PUBLISH_MESSAGES = new Array<{ topic: string; buffer: Buffer; partition: number | null | undefined }>();

  constructor(
    host: string,
    port: number,
    username: string,
    password: string,
    securityProtocol: 'plaintext' | 'ssl' | 'sasl_plaintext' | 'sasl_ssl' | undefined,
    mechanism: 'GSSAPI' | 'PLAIN' | 'SCRAM-SHA-256' | 'SCRAM-SHA-512' | 'OAUTHBEARER',
    groupId: string
  ) {
    this.kafkaConsumer = new KafkaConsumer({
      'bootstrap.servers': `${host}:${port}`,
      'security.protocol': securityProtocol,
      'sasl.mechanisms': mechanism,
      'sasl.username': username,
      'sasl.password': password,
      'group.id': groupId,
      'auto.offset.reset': 'earliest',
      'enable.auto.commit': false
    }).connect();

    this.kafkaConsumer.on('ready', () => {
      for (let index = 0; index < this.AWAITING_SUBSCRIPTIONS.length; index++) {
        const topicName = this.AWAITING_SUBSCRIPTIONS[index];

        this.kafkaConsumer.subscribe([ topicName ]);
      }

      this.kafkaConsumer.consume();
    });

    this.kafkaConsumer.on('event.error', (error) => {
      Logger.error(error, KafkaProvider.name);
    });

    this.kafkaProducer = new KafkaProducer({
      'bootstrap.servers': `${host}:${port}`,
      'security.protocol': securityProtocol,
      'sasl.mechanisms': mechanism,
      'sasl.username': username,
      'sasl.password': password,
      'linger.ms': 0
    }).connect();

    this.kafkaProducer.on('ready', () => {
      if (!this.AWAITING_PUBLISH_MESSAGES.length) {
        return;
      }

      for (const { topic, buffer, partition } of this.AWAITING_PUBLISH_MESSAGES) {
        this.kafkaProducer.produce(topic, partition, buffer, Buffer.alloc(0));
      }
    });

    this.kafkaProducer.on('event.error', (error) => {
      Logger.error(error, KafkaProvider.name);
    });
  }

  public async onModuleInit(): Promise<void> {
    this.discoveryService.getProviders().forEach((provider: InstanceWrapper<Type<unknown> | Function>) => {
      const instance = !provider.metatype || provider.inject ? provider.instance?.constructor : provider.metatype;

      if (!instance) {
        return;
      }

      const topicName = this.reflector.get('x-spacy:on_message_event_metadata', instance);

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

      const kafkaMessage = message as KafkaMessage;

      kafkaMessage.ack = () => {
        this.kafkaConsumer.commitMessageSync(message);
      };

      method.call(messageListener, message);
    });
  }

  public async subscribe(...topics: string[]) {
    if (!this.kafkaConsumer.isConnected()) {
      return this.AWAITING_SUBSCRIPTIONS.push(...topics);
    }

    this.kafkaConsumer.subscribe(topics);
  }

  public async publish(topic: string, buffer: Buffer, partition: number | null | undefined = -1) {
    if (!this.kafkaProducer.isConnected()) {
      return this.AWAITING_PUBLISH_MESSAGES.push({ topic, buffer, partition });
    }

    this.kafkaProducer.produce(topic, partition, buffer, Buffer.alloc(0));
  }
}

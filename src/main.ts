import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { KafkaModule } from '@x-spacy/kafka/modules/KafkaModule';

@Module({
  imports: [
    KafkaModule.forRoot({
      host: 'pkc-p11xm.us-east-1.aws.confluent.cloud',
      port: 9092,
      username: 'IQUR4FGRM7ZGA4AY',
      password: 'tO5aacz15FOZdLBKjD82WPczzJ+Z2auNkCniMHZ0KxWPQI6/Fbd6EVSWc6FPJawN',
      securityProtocol: 'sasl_ssl',
      mechanism: 'PLAIN',
      groupId: 'macbook-pro-de-vinicius-gutierrez'
    })
  ]
})
class Application {
  public static async bootstrap() {
    const application = await NestFactory.create(Application);

    application.init();
  }
}

Application.bootstrap();

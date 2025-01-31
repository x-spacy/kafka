import { DynamicModule } from '@nestjs/common';
import {
  DiscoveryModule,
  DiscoveryService,
  ModuleRef,
  Reflector
} from '@nestjs/core';

import { KafkaProvider } from '@x-spacy/kafka/providers/KafkaProvider';

export class KafkaModule {
  public static forRoot(config: {
    host: string;
    port: number;
    username: string;
    password: string;
    groupId: string;
  }): DynamicModule {
    return {
      global: true,
      module: KafkaModule,
      imports: [],
      providers: [
        {
          provide: 'KafkaProvider',
          useFactory: () => {
            return new KafkaProvider(config.host, config.port, config.username, config.password, config.groupId);
          },
          inject: []
        }
      ],
      exports: [ 'KafkaProvider' ]
    };
  }

  public static subscribe(...topics: string[]): DynamicModule {
    const KafkaSubscriber = {
      provide: 'KafkaSubscriber',
      useFactory: (kafkaProvider: KafkaProvider, discoveryService: DiscoveryService, reflector: Reflector, moduleRef: ModuleRef) => {
        Object.defineProperty(kafkaProvider, 'discoveryService', { value: discoveryService });
        Object.defineProperty(kafkaProvider, 'reflector', { value: reflector });
        Object.defineProperty(kafkaProvider, 'moduleRef', { value: moduleRef });

        return kafkaProvider.subscribe(...topics);
      },
      inject: [ 'KafkaProvider', DiscoveryService, Reflector, ModuleRef ]
    };

    return {
      global: true,
      module: KafkaModule,
      imports: [ DiscoveryModule, KafkaModule ],
      providers: [ DiscoveryService, Reflector, KafkaSubscriber ],
      exports: []
    };
  }
}

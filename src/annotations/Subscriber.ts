import { SetMetadata } from '@nestjs/common';

export function Subscriber(topicName: string): ClassDecorator {
  return (target: Function) => {
    SetMetadata('x-spacy:on_message_event_metadata', topicName)(target);
  };
}

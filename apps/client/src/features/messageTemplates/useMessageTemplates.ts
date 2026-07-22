import { useQuery } from '@tanstack/react-query';

import {
  MessageType,
  messageTemplatesApi,
} from '@/features/messageTemplates/messageTemplatesApi';

// Filters to Overdue client-side — same scope decision as before the
// backend refactor (client explicitly chose to keep this screen scoped to
// `overdue`; the other three types are real but out of scope). Worth
// revisiting now that the screen is read-only-anyway — showing all four
// wouldn't need any new UI, just removing this filter.
export function useMessageTemplates() {
  return useQuery({
    queryKey: ['messageTemplates'],
    queryFn: messageTemplatesApi.getAll,
    select: (templates) =>
      templates.filter((template) => template.type === MessageType.Overdue),
  });
}

/**
 * json-render schema for React — defined here to avoid importing
 * @json-render/react (which pulls in React.createContext) in server contexts.
 *
 * This is equivalent to: import { schema } from "@json-render/react"
 */
import { defineSchema } from '@json-render/core';

export const schema = defineSchema((s) => ({
    spec: s.object({
        root: s.string(),
        elements: s.record(
            s.object({
                type: s.ref('catalog.components'),
                props: s.propsOf('catalog.components'),
                children: s.array(s.string()),
                visible: s.any(),
            }),
        ),
    }),
    catalog: s.object({
        components: s.map({
            props: s.zod(),
            slots: s.array(s.string()),
            description: s.string(),
            example: s.any(),
        }),
        actions: s.map({
            params: s.zod(),
            description: s.string(),
        }),
    }),
}));

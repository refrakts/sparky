import type * as React from 'react';

import type { TextureVariant } from '@/components/ui/bg-image-texture';
import { cn } from '@/lib/utils';

const textureMap: Record<Exclude<TextureVariant, 'none'>, string> = {
    'fabric-of-squares': '/textures/fabric-of-squares.png',
    'grid-noise': '/textures/grid-noise.png',
    inflicted: '/textures/inflicted.png',
    'debut-light': '/textures/debut-light.png',
    groovepaper: '/textures/groovepaper.png',
};

function Card({
    className,
    size = 'default',
    texture = 'fabric-of-squares',
    textureOpacity = 0.03,
    children,
    ...props
}: React.ComponentProps<'div'> & {
    size?: 'default' | 'sm';
    texture?: TextureVariant;
    textureOpacity?: number;
}) {
    const textureUrl = texture !== 'none' ? textureMap[texture] : null;
    return (
        <div
            data-slot="card"
            data-size={size}
            className={cn(
                'group/card relative flex flex-col gap-4 overflow-hidden rounded-xl bg-card py-4 text-sm text-card-foreground ring-1 ring-foreground/10 has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:gap-3 data-[size=sm]:py-3 data-[size=sm]:has-data-[slot=card-footer]:pb-0 *:[img:first-child]:rounded-t-xl *:[img:last-child]:rounded-b-xl',
                className,
            )}
            {...props}
        >
            {textureUrl && (
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0"
                    style={{
                        backgroundImage: `url(${textureUrl})`,
                        backgroundRepeat: 'repeat',
                        opacity: textureOpacity,
                    }}
                />
            )}
            {children}
        </div>
    );
}

function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot="card-header"
            className={cn(
                'relative group/card-header @container/card-header grid auto-rows-min items-start gap-1 rounded-t-xl px-4 group-data-[size=sm]/card:px-3 has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-4 group-data-[size=sm]/card:[.border-b]:pb-3',
                className,
            )}
            {...props}
        />
    );
}

function CardTitle({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot="card-title"
            className={cn(
                'font-heading text-base leading-snug font-medium group-data-[size=sm]/card:text-sm',
                className,
            )}
            {...props}
        />
    );
}

function CardDescription({ className, ...props }: React.ComponentProps<'div'>) {
    return <div data-slot="card-description" className={cn('text-sm text-muted-foreground', className)} {...props} />;
}

function CardAction({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot="card-action"
            className={cn('col-start-2 row-span-2 row-start-1 self-start justify-self-end', className)}
            {...props}
        />
    );
}

function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot="card-content"
            className={cn('relative px-4 group-data-[size=sm]/card:px-3', className)}
            {...props}
        />
    );
}

function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot="card-footer"
            className={cn(
                'relative flex items-center rounded-b-xl border-t bg-muted/50 p-4 group-data-[size=sm]/card:p-3',
                className,
            )}
            {...props}
        />
    );
}

export { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle };

'use client';

import { createContext, type ReactNode, useCallback, useContext, useState } from 'react';

interface PanelState {
    content: ReactNode | null;
    title: string;
}

interface ChatPanelContextValue {
    panelContent: ReactNode | null;
    panelTitle: string;
    panelOpen: boolean;
    openPanel: (content: ReactNode, title: string) => void;
    closePanel: () => void;
}

const ChatPanelContext = createContext<ChatPanelContextValue | null>(null);

export function useChatPanel() {
    const context = useContext(ChatPanelContext);
    if (!context) {
        throw new Error('useChatPanel must be used within <ChatPanelProvider>');
    }
    return context;
}

export function ChatPanelProvider({ children }: { children: ReactNode }) {
    const [panel, setPanel] = useState<PanelState>({
        content: null,
        title: '',
    });

    const openPanel = useCallback((content: ReactNode, title: string) => {
        setPanel({ content, title });
    }, []);

    const closePanel = useCallback(() => {
        setPanel({ content: null, title: '' });
    }, []);

    return (
        <ChatPanelContext.Provider
            value={{
                panelContent: panel.content,
                panelTitle: panel.title,
                panelOpen: panel.content !== null,
                openPanel,
                closePanel,
            }}
        >
            {children}
        </ChatPanelContext.Provider>
    );
}

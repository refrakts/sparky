import { ChatBackground } from '@/components/chat/chat-background';
import { ChatPage } from '@/components/chat/chat-page';

export default function HomePage() {
    return (
        <div className="relative isolate flex h-full flex-col">
            <ChatBackground />
            <ChatPage />
        </div>
    );
}

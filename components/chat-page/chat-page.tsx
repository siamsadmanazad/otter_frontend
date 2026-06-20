"use client";
import React, { useState } from "react";

import { useChatLogic } from "./useChatLogic";
import { ChatList } from "./chat-list";
import { ChatArea } from "./chat-area";
import { NewChatDialog } from "./new-chat-dialog";

export function ChatPage() {
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);

  const {
    currentUserId,
    conversations,
    isLoadingConversations,
    activeId,
    activeConversation,
    messages,
    isLoadingMessages,
    hasMore,
    loadMore,
    newMessage,
    setNewMessage,
    sending,
    selectConversation,
    clearActive,
    sendMessage,
    startConversationWith,
    messagesEndRef,
  } = useChatLogic();

  return (
    <div className="bg-gray-50 h-screen flex flex-col">
      {/* Mobile header */}
      <div className="md:hidden sticky top-0 z-10 bg-white border-b px-4 py-3">
        <h1 className="text-xl font-bold">Messages</h1>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <ChatList
          conversations={conversations}
          activeId={activeId}
          isLoading={isLoadingConversations}
          onSelect={selectConversation}
          onNewChat={() => setIsNewChatOpen(true)}
        />

        <ChatArea
          conversation={activeConversation}
          messages={messages}
          currentUserId={currentUserId}
          isLoadingMessages={isLoadingMessages}
          hasMore={hasMore}
          onLoadMore={loadMore}
          newMessage={newMessage}
          setNewMessage={setNewMessage}
          onSend={sendMessage}
          sending={sending}
          onBack={clearActive}
          messagesEndRef={messagesEndRef}
        />
      </div>

      <NewChatDialog
        isOpen={isNewChatOpen}
        onClose={() => setIsNewChatOpen(false)}
        currentUserId={currentUserId ?? undefined}
        onSelectUser={(userId) => startConversationWith(userId)}
      />
    </div>
  );
}

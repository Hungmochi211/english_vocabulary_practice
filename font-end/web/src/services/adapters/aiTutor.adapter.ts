import { vocabularyApi } from '@/services/api/vocabulary.api';
import type { AiChatMessage, AiConversation, VocabularyItem } from '@/types/models';

export const AI_CONVERSATIONS_STORAGE_KEY = 'lexitag:v1:ai-conversations';

export interface AiMessageReply {
  conversation: AiConversation;
  userMessage: AiChatMessage;
  assistantMessage: AiChatMessage;
}

const FALLBACK_OXFORD_SNIPPETS: Record<
  string,
  Pick<VocabularyItem, 'word' | 'phonetic' | 'partOfSpeech' | 'cefrLevel' | 'vietnameseMeaning' | 'exampleEn' | 'exampleVi'>
> = {
  environment: {
    word: 'environment',
    phonetic: '/ɪnˈvaɪrənmənt/',
    partOfSpeech: 'n',
    cefrLevel: 'B1',
    vietnameseMeaning: 'môi trường',
    exampleEn: 'Everyone should help protect the environment.',
    exampleVi: 'Mọi người đều nên góp phần bảo vệ môi trường.',
  },
  peaceful: {
    word: 'peaceful',
    phonetic: '/ˈpiːsfl/',
    partOfSpeech: 'adj',
    cefrLevel: 'A1',
    vietnameseMeaning: 'yên bình, thanh bình',
    exampleEn: 'The village looks very peaceful in the early morning.',
    exampleVi: 'Ngôi làng trông thật yên bình vào sáng sớm.',
  },
  recycle: {
    word: 'recycle',
    phonetic: '/ˌriːˈsaɪkl/',
    partOfSpeech: 'v',
    cefrLevel: 'B1',
    vietnameseMeaning: 'tái chế',
    exampleEn: 'We recycle plastic bottles and paper at school.',
    exampleVi: 'Chúng tôi tái chế chai nhựa và giấy ở trường.',
  },
};

function readConversations(): AiConversation[] {
  try {
    const raw = window.localStorage.getItem(AI_CONVERSATIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AiConversation[]) : [];
  } catch {
    return [];
  }
}

function writeConversations(conversations: AiConversation[]): void {
  try {
    window.localStorage.setItem(AI_CONVERSATIONS_STORAGE_KEY, JSON.stringify(conversations.slice(0, 30)));
  } catch {
    // Ignore storage quota errors
  }
}

function createWelcomeConversation(): AiConversation {
  return {
    id: `conv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: 'Hội thoại từ vựng mới',
    updatedAt: new Date().toISOString(),
    messages: [
      {
        id: `msg-welcome-${Date.now()}`,
        role: 'assistant',
        content:
          'Xin chào! Mình là Trợ lý AI LexiTag. Bạn có thể hỏi nghĩa, cách dùng, câu ví dụ hoặc phân biệt từ vựng trong kho Oxford 3000 nhé.',
        detectedWords: [],
        createdAt: new Date().toISOString(),
      },
    ],
  };
}

function extractCandidateEnglishWords(prompt: string): string[] {
  const stopWords = new Set([
    'cho', 'minh', 'toi', 'tu', 'vung', 'va', 'cach', 'dung', 'vi', 'du', 'nghia', 'la', 'gi',
    'phan', 'biet', 'cua', 'nhe', 'giup', 'voi', 've', 'trong', 'tieng', 'anh', 'hay', 'khac',
    'the', 'and', 'for', 'with', 'how', 'use', 'word', 'meaning', 'example',
  ]);
  const tokens = prompt
    .toLowerCase()
    .match(/[a-z]{2,}/g);
  if (!tokens) return [];
  return Array.from(new Set(tokens.filter((t) => !stopWords.has(t)))).slice(0, 4);
}

async function resolveVocabularyMatches(prompt: string): Promise<
  Array<
    Pick<
      VocabularyItem,
      'word' | 'phonetic' | 'partOfSpeech' | 'cefrLevel' | 'vietnameseMeaning' | 'exampleEn' | 'exampleVi'
    >
  >
> {
  const candidates = extractCandidateEnglishWords(prompt);
  const matched: Array<
    Pick<
      VocabularyItem,
      'word' | 'phonetic' | 'partOfSpeech' | 'cefrLevel' | 'vietnameseMeaning' | 'exampleEn' | 'exampleVi'
    >
  > = [];

  for (const token of candidates) {
    try {
      const res = await vocabularyApi.searchVocabularies({ q: token, limit: 3 });
      const exact = res.items.find((item) => item.word.toLowerCase() === token) ?? res.items[0];
      if (exact && !matched.some((m) => m.word.toLowerCase() === exact.word.toLowerCase())) {
        matched.push(exact);
        continue;
      }
    } catch {
      // Fallback below
    }
    const fallback = FALLBACK_OXFORD_SNIPPETS[token];
    if (fallback && !matched.some((m) => m.word.toLowerCase() === fallback.word.toLowerCase())) {
      matched.push(fallback);
    }
  }

  return matched;
}

export const aiTutorAdapter = {
  async listConversations(): Promise<AiConversation[]> {
    const existing = readConversations();
    if (existing.length > 0) return existing;
    const initial = [createWelcomeConversation()];
    writeConversations(initial);
    return initial;
  },

  async createConversation(): Promise<AiConversation> {
    const conv = createWelcomeConversation();
    const next = [conv, ...readConversations()];
    writeConversations(next);
    return conv;
  },

  async sendMessage(conversationId: string, prompt: string): Promise<AiMessageReply> {
    const cleanPrompt = prompt.trim();
    const conversations = readConversations();
    let target = conversations.find((c) => c.id === conversationId);
    if (!target) {
      target = createWelcomeConversation();
      conversations.unshift(target);
    }

    const userMessage: AiChatMessage = {
      id: `msg-u-${Date.now()}`,
      role: 'user',
      content: cleanPrompt,
      createdAt: new Date().toISOString(),
    };

    const matches = await resolveVocabularyMatches(cleanPrompt);
    const detectedWords = matches.map((m) => m.word);

    let replyText: string;
    if (matches.length > 0) {
      const lines = matches.map(
        (m) =>
          `• ${m.word} (${m.partOfSpeech}, trình độ ${m.cefrLevel}) ${m.phonetic}\n  Nghĩa: ${m.vietnameseMeaning}\n  Ví dụ: "${m.exampleEn}" — ${m.exampleVi}`,
      );
      replyText = `Dưới đây là giải thích chi tiết theo kho Oxford 3000:\n\n${lines.join('\n\n')}\n\nMẹo ghi nhớ: Hãy nghe phát âm và thử tự đặt thêm 1 câu gắn với thói quen hằng ngày của bạn!`;
    } else {
      replyText =
        'Mình đã nhận được câu hỏi của bạn! Hãy kèm thêm từ tiếng Anh cụ thể (ví dụ: "environment", "peaceful", "recycle") để mình tra phiên âm IPA, nghĩa chuẩn Oxford 3000 và câu ví dụ song ngữ cho bạn nhé.';
    }

    const assistantMessage: AiChatMessage = {
      id: `msg-a-${Date.now() + 1}`,
      role: 'assistant',
      content: replyText,
      detectedWords,
      createdAt: new Date().toISOString(),
    };

    const nextTitle =
      target.messages.length <= 1 ? cleanPrompt.slice(0, 42) || target.title : target.title;

    const updatedConv: AiConversation = {
      ...target,
      title: nextTitle,
      updatedAt: new Date().toISOString(),
      messages: [...target.messages, userMessage, assistantMessage],
    };

    const nextList = [
      updatedConv,
      ...conversations.filter((c) => c.id !== updatedConv.id),
    ];
    writeConversations(nextList);

    return {
      conversation: updatedConv,
      userMessage,
      assistantMessage,
    };
  },

  async deleteConversation(conversationId: string): Promise<void> {
    const remaining = readConversations().filter((c) => c.id !== conversationId);
    writeConversations(remaining.length > 0 ? remaining : [createWelcomeConversation()]);
  },
};

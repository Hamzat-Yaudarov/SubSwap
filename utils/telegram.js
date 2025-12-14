import crypto from 'crypto';
import { getBotInstance } from '../bot/bot.js';

const BOT_TOKEN = process.env.BOT_TOKEN;

export function validateWebAppData(initData) {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    params.delete('hash');

    // Sort and create string for verification
    const dataCheckString = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

    // Create HMAC
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
    const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    return computedHash === hash;
  } catch (err) {
    console.error('WebApp validation error:', err);
    return false;
  }
}

export async function checkChatMembership(chatId, userId) {
  try {
    const bot = getBotInstance();
    if (!bot) return false;

    const member = await bot.getChatMember(chatId, userId);
    return ['member', 'administrator', 'creator'].includes(member.status);
  } catch (err) {
    console.error('Failed to check chat membership:', err.message);
    return false;
  }
}

export async function getChatInfo(chatId) {
  try {
    const bot = getBotInstance();
    if (!bot) return null;

    const chat = await bot.getChat(chatId);
    return {
      id: chat.id,
      title: chat.title,
      type: chat.type,
      members_count: chat.get_members_count ? await bot.getChatMembersCount(chatId) : null
    };
  } catch (err) {
    console.error('Failed to get chat info:', err.message);
    return null;
  }
}

export function extractChatIdFromLink(link) {
  // Handle t.me/channel_name or t.me/+code formats
  try {
    const url = new URL(link.startsWith('http') ? link : `https://${link}`);
    const pathname = url.pathname;

    // Extract username or id
    let chatIdentifier = pathname.replace(/^\//, '');
    
    if (chatIdentifier.startsWith('+')) {
      // Supergroup link like t.me/+ABC123
      return { type: 'link', value: chatIdentifier };
    } else if (chatIdentifier.startsWith('@')) {
      // Username like @channel_name
      return { type: 'username', value: chatIdentifier };
    } else {
      // Username without @ like channel_name
      return { type: 'username', value: '@' + chatIdentifier };
    }
  } catch (err) {
    console.error('Failed to extract chat ID:', err.message);
    return null;
  }
}

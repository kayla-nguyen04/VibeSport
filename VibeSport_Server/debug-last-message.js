const mongoose = require('mongoose');
const MONGODB_URI = 'mongodb+srv://vibesport:longquadeptrai@cluster0.auxczve.mongodb.net/vibesport?appName=Cluster0';

const conversationSchema = new mongoose.Schema({}, { strict: false });
const Conversation = mongoose.model('Conversation', conversationSchema, 'conversations');

const messageSchema = new mongoose.Schema({}, { strict: false });
const Message = mongoose.model('Message', messageSchema, 'messages');

async function debug() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected!');
  const conversations = await Conversation.find({ name: 'Giao lưu' });
  console.log('CONVERSATIONS:');
  for (const c of conversations) {
    console.log({
      _id: c._id,
      name: c.name,
      lastMessage: c.get('lastMessage'),
      lastMessageSenderId: c.get('lastMessageSenderId'),
      lastMessageAt: c.get('lastMessageAt')
    });

    const messages = await Message.find({ conversationId: c._id }).sort({ createdAt: -1 }).limit(5);
    console.log('LATEST 5 MESSAGES IN THIS CONVERSATION:');
    for (const m of messages) {
      console.log({
        _id: m._id,
        senderId: m.get('senderId'),
        type: m.get('type'),
        content: m.get('content'),
        mediaUrl: m.get('mediaUrl'),
        createdAt: m.createdAt
      });
    }
  }
  await mongoose.disconnect();
}
debug();

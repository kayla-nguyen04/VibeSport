try {
  require('node:dns').setServers(['8.8.8.8', '1.1.1.1']);
} catch (err) {}

const mongoose = require('mongoose');
const MONGODB_URI = 'mongodb+srv://vibesport:longquadeptrai@cluster0.auxczve.mongodb.net/vibesport?appName=Cluster0';

const conversationSchema = new mongoose.Schema({
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  name: String,
  isGroup: Boolean,
  avatar: String
}, { strict: false });
const Conversation = mongoose.model('Conversation', conversationSchema, 'conversations');

const userSchema = new mongoose.Schema({
  name: String,
  picture: String
}, { strict: false });
const User = mongoose.model('User', userSchema, 'users');

async function dump() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected!');
  const list = await Conversation.find().populate('participants', 'name picture');
  console.log('CONVERSATIONS DUMP:');
  for (const c of list) {
    console.log(JSON.stringify({
      _id: c._id,
      name: c.name,
      isGroup: c.isGroup,
      participants: c.participants.map(p => ({ _id: p._id, name: p.name })),
      avatar: c.avatar
    }, null, 2));
  }
  await mongoose.disconnect();
}
dump();

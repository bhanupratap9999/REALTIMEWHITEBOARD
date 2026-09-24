import mongoose from 'mongoose';

let isConnected = false;
let isInMemoryFallback = false;
let connectedUri = '';
let lastError = null;

export const connectDB = async () => {
  const customUri = process.env.MONGODB_URI;
  const isCloudUri = customUri && (customUri.startsWith('mongodb+srv://') || !customUri.includes('127.0.0.1') && !customUri.includes('localhost'));
  const primaryUri = customUri || 'mongodb://127.0.0.1:27017/whiteboard_ot';

  mongoose.set('strictQuery', false);

  // If user provided a cloud / Atlas URI, connect directly to it
  if (isCloudUri) {
    try {
      console.log('📡 Connecting to custom/cloud MongoDB...');
      await mongoose.connect(primaryUri, {
        serverSelectionTimeoutMS: 8000, // Generous timeout for cloud networks
      });
      isConnected = true;
      isInMemoryFallback = false;
      connectedUri = primaryUri;
      lastError = null;
      console.log('✅ Successfully connected to custom MongoDB!');
      return;
    } catch (err) {
      lastError = err.message;
      console.error('❌ Failed to connect to custom MongoDB:', err.message);
      console.warn('👉 Tip for MongoDB Atlas:');
      console.warn('   1. Ensure Network Access has IP 0.0.0.0/0 (allow from anywhere) added.');
      console.warn('   2. Verify your database username and password in the URI.');
      console.warn('   3. Ensure special characters in password are URL-encoded.');
    }
  } else {
    // Local MongoDB attempts
    try {
      await mongoose.connect(primaryUri, {
        serverSelectionTimeoutMS: 3000,
      });
      isConnected = true;
      isInMemoryFallback = false;
      connectedUri = primaryUri;
      lastError = null;
      console.log('✅ Connected to MongoDB at:', primaryUri);
      return;
    } catch (err1) {
      console.warn(`Local connect attempt on ${primaryUri} failed: ${err1.message}`);
      
      // Try fallback to localhost if 127.0.0.1 was used (or vice-versa)
      const altUri = primaryUri.includes('127.0.0.1')
        ? primaryUri.replace('127.0.0.1', 'localhost')
        : primaryUri.replace('localhost', '127.0.0.1');

      try {
        await mongoose.connect(altUri, { serverSelectionTimeoutMS: 3000 });
        isConnected = true;
        isInMemoryFallback = false;
        connectedUri = altUri;
        lastError = null;
        console.log('✅ Connected to MongoDB at alternate:', altUri);
        return;
      } catch (err2) {
        lastError = err2.message;
        console.warn(`Local alternate ${altUri} failed: ${err2.message}`);
      }
    }
  }

  // If connection failed, gracefully operate in In-Memory fallback mode so app never crashes
  isConnected = false;
  isInMemoryFallback = true;
  connectedUri = 'in-memory';
  console.warn('⚠️ Operating in resilient IN-MEMORY fallback mode.');
  console.log('💡 All whiteboard, OT operations, and persistence function smoothly in-memory!');
};

export const getDBStatus = () => {
  // Extract database name from URI if possible
  let dbName = 'whiteboard_ot';
  if (connectedUri && connectedUri !== 'in-memory') {
    try {
      const match = connectedUri.match(/\/([^/?]+)(\?|$)/);
      if (match && match[1]) dbName = match[1];
    } catch (e) {}
  }

  return {
    connected: isConnected,
    isInMemoryFallback,
    type: isConnected ? 'mongodb' : 'in-memory',
    databaseName: isConnected ? dbName : 'in-memory-cache',
    error: lastError,
    uri: isConnected
      ? (connectedUri.includes('@') ? connectedUri.replace(/:([^:@]+)@/, ':***@') : connectedUri)
      : 'none',
  };
};

const passport =require('passport');
const GoogleStrategy = require('passport-google-oauth20');
const InstagramStrategy= require('passport-instagram');

const {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  INSTAGRAM_CLIENT_ID,
  INSTAGRAM_CLIENT_SECRET,
  OAUTH_CALLBACK_BASE = 'http://localhost:3000'
} = process.env;

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((obj, done) => {
  done(null, obj);
});

// Google Strategy
if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    callbackURL: `${OAUTH_CALLBACK_BASE}/auth/google/callback`
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const user = {
        id: profile.id,
        displayName: profile.displayName,
        email: profile.emails?.[0]?.value,
        photo: profile.photos?.[0]?.value,
        provider: 'google'
      };
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }));
}

// Instagram Strategy
if (INSTAGRAM_CLIENT_ID && INSTAGRAM_CLIENT_SECRET) {
  passport.use(new InstagramStrategy({
    clientID: INSTAGRAM_CLIENT_ID,
    clientSecret: INSTAGRAM_CLIENT_SECRET,
    callbackURL: `${OAUTH_CALLBACK_BASE}/auth/instagram/callback`
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const user = {
        id: profile.id,
        displayName: profile.displayName,
        username: profile.username,
        photo: profile._json.data.profile_picture,
        provider: 'instagram'
      };
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }));
}

export default passport;
const express = require('express');
const router = express.Router();
const passport = require('../passport');

// Google
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get(
    '/google/callback',
    passport.authenticate('google', { failureRedirect: '/auth/failure', session: true }),
    (req, res) => {
        const user = req.user || {};
        const payload = JSON.stringify(user).replace(/</g, '\\u003c');
        res.send(`<!doctype html><html><body>
      <script>
        try {
          window.opener.postMessage({ type: 'oauth', user: ${payload} }, window.location.origin);
        } catch(e){}
        window.close();
      </script>
    </body></html>`);
    }
);

router.get('/failure', (req, res) => res.status(401).send('Authentication failed'));

// Instagram routes
router.get('/instagram', passport.authenticate('instagram'));
router.get('/instagram/callback',
    passport.authenticate('instagram', { failureRedirect: '/auth/failure' }),
    (req, res) => {
        const user = req.user || {};
        const payload = JSON.stringify(user).replace(/</g, '\\u003c');
        res.send(`
      <script>
        window.opener.postMessage({ type: 'oauth', user: ${payload} }, window.location.origin);
        window.close();
      </script>
    `);
    }
);

// TikTok routes
router.get('/tiktok', passport.authenticate('tiktok'));
router.get('/tiktok/callback',
    passport.authenticate('tiktok', { failureRedirect: '/auth/failure' }),
    (req, res) => {
        const user = req.user || {};
        const payload = JSON.stringify(user).replace(/</g, '\\u003c');
        res.send(`
      <script>
        window.opener.postMessage({ type: 'oauth', user: ${payload} }, window.location.origin);
        window.close();
      </script>
    `);
    }
);

module.exports = router;
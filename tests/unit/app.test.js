// tests/unit/app.test.js
import { createPost, deletePost, getPosts } from '../scripts/social/posts.js';
import { setupDatabase, teardownDatabase } from '../scripts/utils/storage.js';

describe('MoodShare App Tests', () => {
  beforeAll(async () => {
    await setupDatabase();
  });

  afterAll(async () => {
    await teardownDatabase();
  });

  test('should create a new post', async () => {
    const postContent = { text: 'Feeling great!', mood: '#ffcc00' };
    const post = await createPost(postContent);
    expect(post).toHaveProperty('id');
    expect(post.text).toBe(postContent.text);
  });

  test('should retrieve posts', async () => {
    const posts = await getPosts();
    expect(Array.isArray(posts)).toBe(true);
  });

  test('should delete a post', async () => {
    const postContent = { text: 'This will be deleted', mood: '#ff0000' };
    const post = await createPost(postContent);
    const deletedPost = await deletePost(post.id);
    expect(deletedPost).toBe(true);
  });
});
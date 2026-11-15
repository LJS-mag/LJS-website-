import { defineCollection, z } from 'astro:content';
import { glob, file } from 'astro/loaders';

/* Content lives in /content as plain files. The admin page edits these files and the site rebuilds.
   Every schema below runs at build time, so a bad edit fails the build instead of breaking the live site. */

const theme = z.enum(['c0', 'c1', 'c2', 'c3', 'c4', 'c5']);

const team = defineCollection({
  loader: file('content/team.json'),
  schema: z.object({
    name: z.string().min(2),
    role: z.string().min(2),
    group: z.enum(['leadership', 'writers', 'designers']),
    photo: z.string().optional(), // file name inside public/media/team/
    bio: z.string().optional(),
    order: z.number().default(100),
  }),
});

const issues = defineCollection({
  loader: file('content/issues.json'),
  schema: z.object({
    number: z.number().int().positive(),
    title: z.string().min(2),
    date: z.string().regex(/^\d{4}-\d{2}(-\d{2})?$/, 'use YYYY-MM or YYYY-MM-DD'),
    blurb: z.string().min(10),
    theme: theme.default('c0'),
    // Optional home page colours while this is the newest issue: a light background and a dark accent (see src/lib/palette.ts).
    palette: z.object({ bg: z.string().regex(/^#[0-9a-fA-F]{6}$/), accent: z.string().regex(/^#[0-9a-fA-F]{6}$/) }).optional(),
    cover: z.string().optional(), // image path, otherwise a generated cover is shown
    pages: z.array(z.string()).default([]), // page images, in order, relative to /public
    pdf: z.string().optional(),
    sample: z.boolean().default(false), // true = placeholder content, never launch with these
  }),
});

const posts = defineCollection({
  loader: glob({ pattern: '*.md', base: 'content/posts' }),
  schema: z.object({
    title: z.string().min(2),
    author: z.string().min(2),
    category: z.enum(['Poetry', 'Journalism', 'Essay', 'Interview']),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    theme: theme.default('c0'),
    cover: z.string().optional(),
    excerpt: z.string().optional(),
    sample: z.boolean().default(false),
  }),
});

const reviews = defineCollection({
  loader: file('content/reviews.json'),
  schema: z.object({
    target: z.string().regex(/^(issue|post):[a-z0-9-]+$/, 'target must look like issue:issue-04'),
    name: z.string().min(1).max(40),
    rating: z.number().int().min(1).max(5),
    text: z.string().min(10).max(600),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    status: z.enum(['approved', 'hidden']).default('approved'),
    sample: z.boolean().default(false),
  }),
});

const instagram = defineCollection({
  loader: file('content/instagram.json'),
  schema: z.object({
    url: z.string().url().refine((u) => /^https:\/\/(www\.)?instagram\.com\//.test(u), 'must be an instagram.com link'),
    image: z.string().optional(), // photo path relative to /public; a coloured tile is shown without one
    theme: theme.default('c0'),
    count: z.number().int().min(1).max(20).default(1), // number of photos in the post (shows the 1/3 badge)
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    caption: z.string().optional(),
    sample: z.boolean().default(false),
  }),
});

export const collections = { team, issues, posts, reviews, instagram };

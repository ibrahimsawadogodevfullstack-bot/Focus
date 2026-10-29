import assert from 'node:assert/strict';
import test from 'node:test';

import { DAY_MS, dayKey, weekDays } from '../utils/date.js';
import { categoryVideos, daysSince, summarize, weekLabel } from '../services/stats.js';

const NOW = new Date(2026, 9, 29, 10, 0, 0).getTime(); // jeudi 29 octobre 2026

const categories = [
  { id: 'maths', name: 'Maths', channelIds: ['UCaaaaaaaaaaaaaaaaaaaaaa'] },
  { id: 'sciences', name: 'Sciences', channelIds: ['UCbbbbbbbbbbbbbbbbbbbbbb'] },
  { id: 'vide', name: 'Vide', channelIds: [] },
];

function trackingFixture() {
  return {
    days: {
      [dayKey(NOW)]: { seconds: 900, channels: { UCaaaaaaaaaaaaaaaaaaaaaa: 900 } },
    },
    channels: { UCaaaaaaaaaaaaaaaaaaaaaa: 900 },
    videos: {
      v1: {
        videoId: 'v1',
        channelId: 'UCaaaaaaaaaaaaaaaaaaaaaa',
        channelTitle: 'Maths facile',
        title: 'Théorème de Thalès',
        seconds: 600,
        completed: true,
        completedAt: NOW - 60 * 60 * 1000,
        rating: 'solide',
        lastAt: NOW - 30 * 60 * 1000,
      },
      v2: {
        videoId: 'v2',
        channelId: 'UCaaaaaaaaaaaaaaaaaaaaaa',
        channelTitle: 'Maths facile',
        title: 'Exercices',
        seconds: 300,
        completed: false,
        completedAt: null,
        rating: 'fragile',
        lastAt: NOW - 20 * 60 * 1000,
      },
    },
  };
}

test('la progression se calcule sur les vidéos suivies', () => {
  const summary = summarize({
    tracking: trackingFixture(),
    categories,
    videos: [],
    now: NOW,
  });

  const maths = summary.categories.find((item) => item.id === 'maths');

  assert.equal(maths.total, 2, 'deux vidéos suivies');
  assert.equal(maths.completed, 1);
  assert.equal(maths.ratio, 0.5);
  assert.ok(maths.ratio <= 1);
});

test('une catégorie sans vidéo suivie reste à zéro, sans NaN', () => {
  const summary = summarize({
    tracking: trackingFixture(),
    categories,
    videos: [],
    now: NOW,
  });

  const vide = summary.categories.find((item) => item.id === 'vide');

  assert.equal(vide.total, 0);
  assert.equal(vide.completed, 0);
  assert.equal(vide.ratio, 0);
  assert.ok(Number.isFinite(vide.ratio));
});

test('« à revoir » ne peut pas dépasser le nombre de vidéos suivies', () => {
  const summary = summarize({
    tracking: trackingFixture(),
    categories,
    videos: [],
    now: NOW,
  });

  for (const category of summary.categories) {
    assert.ok(category.toReview <= category.total);
  }

  const maths = summary.categories.find((item) => item.id === 'maths');
  assert.equal(maths.toReview, 1);
});

test('l’objectif vient des réglages', () => {
  const base = { tracking: trackingFixture(), categories, videos: [], now: NOW };
  assert.equal(summarize(base).goal, 8);
  assert.equal(summarize({ ...base, goal: 3 }).goal, 3);
});

test('les vidéos finies cette semaine sont comptées une fois', () => {
  const summary = summarize({
    tracking: trackingFixture(),
    categories,
    videos: [],
    now: NOW,
  });

  assert.equal(summary.completedThisWeek, 1);
  assert.equal(summary.activeDays, 1);
  assert.equal(summary.weekSeconds, 900);
});

test('le seuil « négligé » est strictement supérieur à sept jours', () => {
  const tracking = trackingFixture();
  tracking.videos.v1.lastAt = NOW - 7 * DAY_MS;
  tracking.videos.v2.lastAt = NOW - 7 * DAY_MS;

  const summary = summarize({ tracking, categories, videos: [], now: NOW });
  const maths = summary.categories.find((item) => item.id === 'maths');

  assert.notEqual(maths.status.key, 'neglected');

  tracking.videos.v1.lastAt = NOW - 8 * DAY_MS;
  tracking.videos.v2.lastAt = NOW - 8 * DAY_MS;

  const older = summarize({ tracking, categories, videos: [], now: NOW });
  assert.equal(older.categories.find((item) => item.id === 'maths').status.key, 'neglected');
});

test('la semaine contient sept jours distincts, du lundi au dimanche', () => {
  const days = weekDays(NOW);

  assert.equal(days.length, 7);
  assert.equal(new Set(days.map((day) => day.key)).size, 7);
  assert.equal(new Date(days[0].stamp).getDay(), 1);
  assert.equal(new Date(days[6].stamp).getDay(), 0);
  assert.equal(dayKey(days[0].stamp), days[0].key);
  assert.match(weekLabel(NOW), /^\d+ \S+ – \d+ \S+$/);
});

test('le calcul des jours écoulés est stable', () => {
  assert.equal(daysSince(NOW - DAY_MS, NOW), 1);
  assert.equal(daysSince(NOW, NOW), 0);
  assert.equal(daysSince(null, NOW), null);
});

test('categoryVideos fusionne flux et historique sans doublon', () => {
  const rows = categoryVideos({
    tracking: trackingFixture(),
    category: categories[0],
    videos: [
      {
        videoId: 'v1',
        title: 'Théorème de Thalès',
        channelId: 'UCaaaaaaaaaaaaaaaaaaaaaa',
        channelTitle: 'Maths facile',
        publishedAt: NOW,
      },
    ],
  });

  assert.equal(rows.length, 2);
  assert.equal(new Set(rows.map((row) => row.videoId)).size, 2);
  assert.equal(rows[0].videoId, 'v2', 'la plus récente activité en premier');
});

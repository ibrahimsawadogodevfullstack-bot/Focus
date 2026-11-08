import assert from 'node:assert/strict';
import test from 'node:test';

import { dayKey } from '../src/shared/utils/date.ts';
import { splitIntervalByHour } from '../src/shared/utils/timeSlices.ts';
import {
  buildPeriodSummary,
  formatPercent,
  formatVariation,
  formatWatchTime,
  resolvePeriodRange,
} from '../services/viewingSummary.ts';

const NOW = new Date(2026, 10, 8, 15, 0, 0).getTime(); // dimanche 8 novembre 2026

const categories = [
  { id: 'dev', name: 'Dev', channelIds: ['UCdev'] },
  { id: 'lang', name: 'Anglais', channelIds: ['UClang'] },
];

function emptyDay() {
  return {
    seconds: 0,
    byCategory: {},
    byChannel: {},
    byHour: {},
    byFormat: { short: 0, long: 0 },
    bySource: { online: 0, offline: 0 },
    videos: 0,
    completed: 0,
    abandoned: 0,
    sessions: 0,
    contentSeconds: 0,
    speedWeighted: 0,
  };
}

function day(overrides = {}) {
  return { ...emptyDay(), ...overrides };
}

function fixture() {
  const today = dayKey(NOW);
  const yesterday = dayKey(new Date(2026, 10, 7, 12));
  const twoDaysAgo = dayKey(new Date(2026, 10, 6, 12));
  const threeDaysAgo = dayKey(new Date(2026, 10, 5, 12));
  const previousWeek = dayKey(new Date(2026, 9, 30, 12));

  return {
    schemaVersion: 1,
    profileId: 'local',
    days: {
      [today]: day({
        seconds: 1800,
        byCategory: { dev: 1200, gone: 600 },
        byChannel: { UCdev: 1200, UCgone: 600 },
        byHour: { 20: 1800 },
        byFormat: { short: 600, long: 1200 },
        bySource: { online: 1200, offline: 600 },
        videos: 4,
        completed: 2,
        abandoned: 1,
        sessions: 1,
        contentSeconds: 2100,
        speedWeighted: 2700,
      }),
      [yesterday]: day({
        seconds: 900,
        byCategory: { dev: 900 },
        byChannel: { UCdev: 900 },
        byHour: { 19: 900 },
        byFormat: { short: 0, long: 900 },
        bySource: { online: 900, offline: 0 },
        videos: 2,
        completed: 1,
        abandoned: 0,
        sessions: 1,
      }),
      [twoDaysAgo]: day({
        seconds: 600,
        byCategory: { dev: 600 },
        byChannel: { UCdev: 600 },
        byHour: { 21: 600 },
        byFormat: { short: 0, long: 600 },
        bySource: { online: 600, offline: 0 },
        videos: 1,
      }),
      [threeDaysAgo]: day({
        seconds: 300,
        byCategory: { lang: 300 },
        byChannel: { UClang: 300 },
        byHour: { 9: 300 },
        byFormat: { short: 0, long: 300 },
        bySource: { online: 300, offline: 0 },
        videos: 1,
      }),
      [previousWeek]: day({
        seconds: 600,
        byCategory: { dev: 600 },
        byChannel: { UCdev: 600 },
        byHour: { 18: 600 },
        byFormat: { short: 0, long: 600 },
        bySource: { online: 600, offline: 0 },
        videos: 1,
      }),
    },
    videos: {
      v1: {
        videoId: 'v1',
        title: 'Une vidéo',
        channelId: 'UCdev',
        channelTitle: 'Dev',
        format: 'long',
        categoryId: 'dev',
        categoryName: 'Dev',
        seconds: 1200,
        contentSeconds: 1200,
        duration: 1300,
        starts: 2,
        completed: true,
        completedAt: NOW,
        abandonedCount: 0,
        firstAt: NOW - 5000,
        lastAt: NOW,
      },
    },
    categories: {
      dev: { name: 'Dev', seconds: 3300 },
      gone: { name: 'Ancienne', seconds: 600 },
      lang: { name: 'Anglais', seconds: 300 },
    },
    channels: {
      UCdev: { title: 'Dev', seconds: 3300 },
      UCgone: { title: 'Ancienne chaîne', seconds: 600 },
      UClang: { title: 'Anglais', seconds: 300 },
    },
    sessions: [
      { start: NOW - 2 * 60 * 60 * 1000, end: NOW - 60 * 60 * 1000, seconds: 1800, videos: 4 },
      { start: NOW - 26 * 60 * 60 * 1000, end: NOW - 25 * 60 * 60 * 1000, seconds: 900, videos: 2 },
    ],
    shorts: { current: 2, longest: 5, longestAt: NOW },
    lastActivityAt: NOW,
    updatedAt: NOW,
  };
}

test('les périodes sont des jours locaux complets, aujourd’hui inclus', () => {
  const week = resolvePeriodRange('7d', NOW);
  assert.equal(week.dayKeys.length, 7);
  assert.equal(week.dayKeys[0], '2026-11-02');
  assert.equal(week.dayKeys[6], '2026-11-08');
  assert.equal(week.previous.dayKeys[0], '2026-10-26');

  const today = resolvePeriodRange('today', NOW);
  assert.deepEqual(today.dayKeys, ['2026-11-08']);
  assert.deepEqual(today.previous.dayKeys, ['2026-11-07']);
});

test('les totaux, parts et catégories supprimées sont cohérents', () => {
  const summary = buildPeriodSummary({ stats: fixture(), categories, period: '7d', now: NOW });

  assert.equal(summary.totals.seconds, 3600);
  assert.equal(summary.totals.videos, 8);
  assert.equal(summary.totals.activeDays, 4);
  assert.equal(summary.totals.completed, 3);
  assert.equal(summary.totals.abandoned, 1);
  assert.equal(summary.totals.replays, 1);

  const dev = summary.categories.find((item) => item.id === 'dev');
  const gone = summary.categories.find((item) => item.id === 'gone');
  assert.ok(dev);
  assert.equal(dev.seconds, 2700);
  assert.equal(dev.name, 'Dev');
  assert.equal(dev.deleted, false);
  assert.ok(gone);
  assert.equal(gone.name, 'Ancienne');
  assert.equal(gone.deleted, true);

  const categoryTotal = summary.categories.reduce((sum, item) => sum + item.seconds, 0);
  assert.equal(categoryTotal, 3600);
  assert.ok(Math.abs(dev.share - 2700 / 3600) < 1e-9);

  assert.equal(summary.channels[0].name, 'Dev');
  assert.equal(summary.channels[0].seconds, 2700);
});

test('les formats, moments et sessions se répartissent sans perte', () => {
  const summary = buildPeriodSummary({ stats: fixture(), categories, period: '7d', now: NOW });

  assert.equal(summary.formats.short, 600);
  assert.equal(summary.formats.long, 3000);
  assert.equal(summary.formats.short + summary.formats.long, summary.totals.seconds);
  assert.equal(summary.moments.top, 'evening');
  assert.equal(summary.moments.total, 3600);
  assert.equal(summary.weekday.index, 6); // dimanche

  assert.equal(summary.sessions.count, 2);
  assert.equal(summary.sessions.longestSeconds, 1800);
  assert.equal(summary.sessions.averageSeconds, 1350);
  assert.equal(summary.shorts.longest, 5);
  assert.equal(summary.online.offline, 600);
  assert.equal(summary.online.online, 3000);
});

test('les comparaisons et le résumé restent factuels et limités à trois phrases', () => {
  const summary = buildPeriodSummary({
    stats: fixture(),
    categories,
    period: '7d',
    now: NOW,
    goalMinutes: 30,
  });

  assert.equal(summary.comparisons.seconds, 500);
  assert.equal(summary.sentences.length, 3);
  assert.equal(summary.sentences[0].key, 'summaryTopCategory');
  assert.equal(summary.sentences[1].key, 'summaryMore7d');
  assert.equal(summary.sentences[2].key, 'summaryGoalReached');

  const noGoal = buildPeriodSummary({
    stats: fixture(),
    categories,
    period: '7d',
    now: NOW,
    goalMinutes: 0,
  });
  assert.equal(noGoal.sentences[2].key, 'summaryLongestSession');
});

test('une période vide ne fabrique aucun chiffre', () => {
  const summary = buildPeriodSummary({
    stats: fixture(),
    categories,
    period: 'today',
    now: NOW + 40 * 24 * 60 * 60 * 1000,
  });

  assert.equal(summary.totals.seconds, 0);
  assert.equal(summary.hasActivity, false);
  assert.equal(summary.sentences.length, 0);
  assert.equal(summary.days.length, 1);
});

test('les durées et pourcentages suivent la langue', () => {
  assert.equal(formatWatchTime(3900, 'fr'), '1 h 05');
  assert.equal(formatWatchTime(3900, 'en'), '1h 05m');
  assert.equal(formatWatchTime(300, 'fr'), '5 min');
  assert.equal(formatWatchTime(0, 'en'), '0 min');
  assert.equal(formatPercent(0.423, 'fr'), '42 %');
  assert.equal(formatPercent(0.423, 'en'), '42%');
  assert.equal(formatVariation(12, 'fr'), '+12 %');
  assert.equal(formatVariation(-12, 'en'), '−12%');
  assert.equal(formatVariation(0, 'fr'), '0 %');
  assert.equal(formatVariation(null, 'fr'), '');
});

test('un intervalle qui passe minuit est réparti sur deux jours', () => {
  const start = new Date(2026, 11, 31, 23, 59, 30).getTime();
  const end = new Date(2027, 0, 1, 0, 0, 30).getTime();
  const slices = splitIntervalByHour(start, end);

  assert.equal(slices.length, 2);
  assert.equal(slices[0].seconds, 30);
  assert.equal(slices[1].seconds, 30);
  assert.equal(dayKey(slices[0].timestamp), '2026-12-31');
  assert.equal(dayKey(slices[1].timestamp), '2027-01-01');
});

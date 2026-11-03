// Chaînes fournies au premier lancement. L'utilisateur peut en ajouter
// (identifiant, @handle ou URL) et retirer n'importe laquelle : la liste est
// ensuite persistée dans le stockage local (services/storage.js).
export interface DefaultChannel {
  id: string;
  title: string;
}

export const DEFAULT_CHANNELS: DefaultChannel[] = [
  { id: 'UCStdpl2vQncJxvxmyhUU4vw', title: 'Paul Explique' },
  { id: 'UCMK4KX8mQdCpoAuS1I6jAkw', title: 'Bmn-maths' },
  { id: 'UCDhsYgq7tpshCtFtM-9TFvg', title: 'Parlons Cyber' },
  { id: 'UCUclUivgBePqnqDGQ3Jzu2Q', title: 'TOUKIWANTI' },
  { id: 'UCyvNOY08fGEDTc32ldNgkIg', title: 'Professor Of Tricks' },
  { id: 'UCvRgiAmogg7a_BgQ_Ftm6fA', title: 'Le Précepteur' },
  { id: 'UC3MVZ-eKiWXr-UTSlYQDIww', title: 'Intel Devs' },
  { id: 'UCZjpsUMlbjCgRPAWnMlFlaw', title: 'CircuitCindy' },
  { id: 'UC-KkpneJCwWQ2G1KL-CyV_g', title: 'TruMind' },
  { id: 'UCFTYM7lJxnB6foV6TxgFbzg', title: 'Math Gold Medalist' },
  { id: 'UCPvkTl1wFVHbbpfS7Li91Qw', title: 'Majorant' },
  { id: 'UCyJ68afo16G1Zqjt-sijEBA', title: 'No One Cares' },
  { id: 'UC4m0HJfnjKAJPSE-VIEEzKg', title: 'Inception Trader' },
  { id: 'UCFVcxg2z1UZfGUY3WJ2CfxA', title: 'mister dura' },
  { id: 'UCN2K5vZ7hXxwCe54Am-iMXQ', title: 'Wisdom of Hope' },
  { id: 'UCz4tgANd4yy8Oe0iXCdSWfA', title: 'English with Lucy' },
  { id: 'UCR9eVgWM4pdYaoFzgdPmznw', title: 'English in Minutes' },
];

export const DEFAULT_CHANNEL_IDS: string[] = DEFAULT_CHANNELS.map((channel) => channel.id);

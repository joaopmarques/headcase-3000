// Things the head says. Three moods: chill, annoyed, FURIOUS.
export const LINES = {
  poke: [
    ['Ow.', 'Hey!', 'Boop?', 'That tickles. No wait, it hurts.', 'Rude.', 'Excuse me??'],
    ['Stop poking me.', 'I have a family!', 'Do you poke everyone like this?', 'My lawyer will hear about this.', 'OW. Seriously.'],
    ['I WILL BITE THAT FINGER.', 'POKE ME ONE MORE TIME.', 'I KNOW WHERE YOU LIVE. roughly.', 'AAAAAAARGH!'],
  ],
  pinch: [
    ['Ooh, stretchy!', 'Is this skincare?', 'My cheeks!', 'Boing!'],
    ['That is not how faces work.', 'Put my face back!', 'I am not taffy!'],
    ['MY FACE IS NOT A TOY.', 'YOU ARE STRETCHING MY SOUL.', 'UNHAND MY CHEEK!'],
  ],
  pinchHold: [
    ['Ow ow ow ow!', 'Hey, that is attached!', 'Easy, easy!'],
    ['Let go! Let go!', 'That is my FACE!', 'Ow ow OW!'],
    ['LET GO OF MY FACE!', 'I WILL SUE!', 'OW OW OW OW!'],
  ],
  pinchMax: [
    ['It is going to rip!', 'Too far! Too far!', 'I am not made of rubber!'],
    ['IT IS GOING TO RIP!', 'MY FACE HAS LIMITS!'],
    ['YOU ARE TEARING MY SOUL!', 'THIS IS A CRIME!'],
  ],
  slap: [
    ['Wow.', 'Did you just slap me?', 'I felt that in my ancestors.', 'Okay. Okay.'],
    ['How dare you!', 'Right in the dignity!', 'I am calling HR.'],
    ['THAT IS IT!', 'YOU ABSOLUTE GOBLIN!', 'I WILL REMEMBER THIS!'],
  ],
  bonk: [
    ['Bonk!', 'Ow, my everything.', 'I see birds.', 'Where am I?'],
    ['Is this whack-a-mole?!', 'My brain is now soup.', 'Not the head! It is all I have!'],
    ['I AM ONLY A HEAD!', 'STOP BONKING!', 'CONCUSSION NUMBER NINE!'],
  ],
  tickle: [['Hehehe!', 'Stop it! Hahaha!', 'Not there! Hehe!', 'Ahahaha no!', 'Tee hee!']],
  inflate: [['Oh no.', 'I feel floaty.', 'Is this a balloon thing?', 'Ooooh, pressure.', 'I am getting big!']],
  pop: [['I am back, baby!', 'What happened?', 'That was spiritually painful.', 'Did I explode? Cool.']],
  melt: [['I am melting!', 'It is so hot in here.', 'Oh no, my structural integrity.', 'Blblblbl.']],
  twist: [['Wheeeee!', 'My neck! Oh wait, I do not have one.', 'I am a tornado!', 'Everything is spinning.']],
  noodle: [['I am so tall!', 'Noodle mode!', 'Look at me, I am a giraffe.', 'Hellooo up here!']],
  yeet: [['Yeeeeeeet!', 'I am free!', 'Weeeeee!', 'Why do you throw me?']],
  spin: [['Round and round!', 'Wheee!', 'I am going to be sick.']],
  deflate: [['Pfffffff.', 'Oh, that is better.', 'Excuse me.', 'Pardon me.']],
  blep: [['Blep.', 'Mlem.', 'Thbbbt.']],
  hello: [['Hi! I am a head now!', 'Why am I a head?', 'Where is my body?', 'Oh wow, I have a face!', 'Hello, human!']],
  idle: [['Hello? Is anyone there?', 'I am bored. Poke me.', 'I used to have a body, you know.', 'I can hear you breathing.', 'Do something weird.']],
  rage: [['THAT IS IT! I AM LEAVING!', 'I QUIT BEING A HEAD!', 'ENOUGH! GOODBYE!']],
  disco: [['Let us boogie!', 'Disco fever!', 'I can feel the rhythm in my face.']],
};

export const LIES = [
  'I have never eaten a crayon.',
  'I am a real boy.',
  'I read the terms and conditions.',
  'I love doing my taxes.',
  'I always return my shopping cart.',
  'I have a very small nose.',
  'I understand blockchain.',
  'I am not a floating head.',
  'I work out every day.',
  'I did not eat the last cookie.',
];

const NONSENSE_A = ['The moon', 'My left nostril', 'A haunted spoon', 'Grandma', 'The government', 'A tiny horse', 'Your printer', 'The void', 'A confused pigeon', 'Steve'];
const NONSENSE_B = ['is secretly', 'wants to become', 'was once', 'is legally married to', 'is afraid of', 'is powered by', 'invented', 'dreams about', 'sued'];
const NONSENSE_C = ['a potato', 'three raccoons in a coat', 'soup', 'the concept of Tuesday', 'a sentient lasagna', 'jazz', 'an angry toaster', 'forty bees', 'my dentist', 'cheese'];
const NONSENSE_D = ['and nobody talks about it.', 'and I am tired of pretending otherwise.', 'according to science.', 'which explains a lot.', 'and that is why I am a head.', 'Think about it.'];

const pick = (a) => a[Math.floor(Math.random() * a.length)];
export const nonsense = () => `${pick(NONSENSE_A)} ${pick(NONSENSE_B)} ${pick(NONSENSE_C)} ${pick(NONSENSE_D)}`;
export function line(kind, level = 0) {
  const pools = LINES[kind];
  if (!pools) return '';
  return pick(pools[Math.min(level, pools.length - 1)]);
}
export { pick };

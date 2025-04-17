// Dummy extension. This is how I want extensions to look.
export const CONTEXT;
export const AUTHOR = {
  name: "halufun",
  contact: "https://discord.gg/33TUH3pxnP"
};
export const BLOCKS = {
  block1: {
    execute: function world() {
      return "world";
    }
  },
  block2: {
    execute: function hello() {
      return CONTEXT.BLOCKS.block1.execute;
    }
  },
};

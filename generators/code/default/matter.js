// Matter.js (not this file, this: https://cdnjs.cloudflare.com/ajax/libs/matter-js/0.19.0/matter.min.js) is licensed under MIT. See here: https://github.com/liabru/matter-js
const createQueuedAction = (actionCode) => {
    return `
const action = () => { ${actionCode} };
if (Copium.env.matter && Copium.env.matter.ready) {
    action();
} else if (Copium.env.matter && Copium.env.matter.queue) {
    Copium.env.matter.queue.push(action);
} else {
    console.error("Matter.js environment is not initialized. Could not queue action.");
}`;
};

export const main = {
    info: {
        author: `copium-ide`,
        namespace: `matter`,
        name: `Matter.js (Async, Robust)`,
        version: `1.2.1`,
        email: ``,
        website: `https://github.com/copium-ide`,
        notes: `This extension dynamically loads Matter.js (MIT License) from a CDN. Copyright (c) 2014 Liam Brummitt.`,
        description: `A self-contained Matter.js extension with robust async initialization. It awaits the library load and queues actions until the engine is ready.`
    },
    init: function() {
        // This init code remains the same as it is already robust.
        return `
Copium.env.matter = {
    ready: false,
    queue: [],
    engine: null,
    world: null,
    render: null,
    runner: null,
    bodies: {}
};

function loadMatterJSLibrary() {
    return new Promise((resolve, reject) => {
        if (window.Matter) return resolve();
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/matter-js/0.19.0/matter.min.js';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load Matter.js library from the CDN.'));
        document.head.appendChild(script);
    });
}

(async () => {
    try {
        await loadMatterJSLibrary();
        let matterContainer = document.getElementById('copium-matter-canvas');
        if (!matterContainer) {
            matterContainer = document.createElement('div');
            matterContainer.id = 'copium-matter-canvas';
            matterContainer.style.border = '1px solid #aaa';
            matterContainer.style.margin = '10px auto';
            matterContainer.style.overflow = 'hidden';
            document.body.appendChild(matterContainer);
        }

        const env = Copium.env.matter;
        env.engine = Matter.Engine.create();
        env.world = env.engine.world;
        env.render = Matter.Render.create({
            element: matterContainer,
            engine: env.engine,
            options: { width: 800, height: 600, wireframes: false, background: '#f0f0f0' }
        });
        env.runner = Matter.Runner.create();
        
        Matter.Render.run(env.render);
        Matter.Runner.run(env.runner, env.engine);

        env.ready = true;
        env.queue.forEach(action => action());
        env.queue = [];

    } catch (error) {
        console.error("Fatal error during Matter.js initialization:", error);
    }
})();`;
    },
    
    blocks: {
        // The _createAction block has been removed. We now use the module-scoped helper function.

        createBox: {
            text: `create box %name at x:%x y:%y size w:%w h:%h with options:%options`,
            description: `Creates a rectangular physics body.`,
            generate: function(args) {
                const actionCode = `
const box = Matter.Bodies.rectangle(${args.x}, ${args.y}, ${args.w}, ${args.h}, ${args.options});
Copium.env.matter.bodies['${args.name}'] = box;
Matter.World.add(Copium.env.matter.world, box);`;
                // Use the robust, self-contained helper function
                return createQueuedAction(actionCode);
            },
            inputs: { name: `String`, x: `Number`, y: `Number`, w: `Number`, h: `Number`, options: `Object` }
        },

        createCircle: {
            text: `create circle %name at x:%x y:%y with radius:%r with options:%options`,
            description: `Creates a circular physics body.`,
            generate: function(args) {
                const actionCode = `
const circle = Matter.Bodies.circle(${args.x}, ${args.y}, ${args.r}, ${args.options});
Copium.env.matter.bodies['${args.name}'] = circle;
Matter.World.add(Copium.env.matter.world, circle);`;
                // Use the robust, self-contained helper function
                return createQueuedAction(actionCode);
            },
            inputs: { name: `String`, x: `Number`, y: `Number`, r: `Number`, options: `Object` }
        },

        createWalls: {
            text: `create walls for canvas width:%w height:%h`,
            description: `Creates static walls for the scene.`,
            generate: function(args) {
                const actionCode = `
const ground = Matter.Bodies.rectangle(${args.w}/2, ${args.h}+29, ${args.w}, 60, { isStatic: true });
const ceiling = Matter.Bodies.rectangle(${args.w}/2, -29, ${args.w}, 60, { isStatic: true });
const leftWall = Matter.Bodies.rectangle(-29, ${args.h}/2, 60, ${args.h}, { isStatic: true });
const rightWall = Matter.Bodies.rectangle(${args.w}+29, ${args.h}/2, 60, ${args.h}, { isStatic: true });
Matter.World.add(Copium.env.matter.world, [ground, ceiling, leftWall, rightWall]);`;
                // Use the robust, self-contained helper function
                return createQueuedAction(actionCode);
            },
            inputs: { w: `Number`, h: `Number` }
        },

        applyForce: {
            text: `apply force to %name with force vector x:%fx y:%fy`,
            description: `Applies a force to a body.`,
            generate: function(args) {
                const actionCode = `
if (Copium.env.matter.bodies['${args.name}']) {
    Matter.Body.applyForce(Copium.env.matter.bodies['${args.name}'], Copium.env.matter.bodies['${args.name}'].position, { x: ${args.fx}, y: ${args.fy} });
}`;
                // Use the robust, self-contained helper function
                return createQueuedAction(actionCode);
            },
            inputs: { name: `String`, fx: `Number`, fy: `Number` }
        },

        setGravity: {
            text: `set world gravity to x:%x y:%y`,
            description: `Sets the global gravity for the physics world.`,
            generate: function(args) {
                const actionCode = `
Copium.env.matter.engine.gravity.x = ${args.x};
Copium.env.matter.engine.gravity.y = ${args.y};`;
                // Use the robust, self-contained helper function
                return createQueuedAction(actionCode);
            },
            inputs: { x: `Number`, y: `Number` }
        }
    }
};

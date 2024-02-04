
<script>
    import { spring } from 'svelte/motion';
    import { midi } from './stores.js';

    export let hasTrigger = false;
    export let moduleNode;
    export let controlsNode;
    export let deleteNode;
    export let nodeSize = { x: 300, y: 300 };
    export let nodePos = { x: 300, y: 100 };

    let coords = spring({ x: nodePos.x, y: nodePos.y}, {
        stiffness: 0.3,
        damping: 0.5
    });
    let size = spring(0, {
        stiffness: 0.3,
        damping: 0.5
    });
    let triggerSize = spring(0, {
        stiffness: 1,
        damping: 0.5
    });

    let moving = false;
    let controlling = false;

    const moduleClick = () => {
        moving = true;
        if (!controlling) size.set(20);
    };

    const controlsClick = () => { controlling = true };

    const windowUnClick = () => {
        moving = false;
        controlling = false;
        size.set(0);
    };

    const windowMouseMove = (e) => {
        if (moving && !controlling) {
            nodePos.x += e.movementX;
            nodePos.y += e.movementY;
            coords.set({ x: nodePos.x, y: nodePos.y });
        }
    };

    $: if (moduleNode) {
        moduleNode.addEventListener('mousedown', moduleClick);
        moduleNode.addEventListener('touchstart', moduleClick);
    }

    $: if (controlsNode) {
        controlsNode.addEventListener('mousedown', controlsClick);
        controlsNode.addEventListener('touchstart', controlsClick);
    }

    $: if (deleteNode) {
        deleteNode.addEventListener('mousedown', controlsClick);
        deleteNode.addEventListener('touchstart', controlsClick);
    }

    window.addEventListener('mouseup', windowUnClick);
    window.addEventListener('touchend', windowUnClick);

    window.addEventListener('mousemove', windowMouseMove);
    window.addEventListener('touchmove', windowMouseMove);

    $: if ($midi.trigger && hasTrigger) {
        triggerSize.set(2);
    } else {
        triggerSize.set(0);
    }

    $: if (moduleNode) {
        moduleNode.style.left = `${$coords.x-$size/2-$triggerSize/2}px`;
        moduleNode.style.top = `${$coords.y-$size/2-$triggerSize/2}px`;
        moduleNode.style.width = `${nodeSize.x+$size+$triggerSize}px`;
        moduleNode.style.height = `${nodeSize.y+$size+$triggerSize}px`;
    }
</script>
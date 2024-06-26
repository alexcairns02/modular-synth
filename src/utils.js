import { modules, output } from './stores.js';

let mods, out;

// Svelte stores must be subscribed to explicitly in raw JS
modules.subscribe((value) => {
    mods = value;
});
output.subscribe((value) => {
    out = value;
});

// Returns a new ID for a new module being created
export function createNewId() {
    for (let i=0; i<Object.keys(mods).length+1; i++) {
        if (!mods[i]) return i;
    }
}

// Destroys a given module
export function destroyModule(module) {
    if (module.isAudio) module.clearCurrents();

    module.destroyed = true;

    module.component.parentNode.removeChild(module.component);

    if (module.state.cvId || module.state.cvId == 0) {
        modules.update((ms) => {
            ms[module.state.cvId].removeOutput(module.state.id+".1", module.cv);
            return ms;
        })
    }
    if (module.state.cvId2 || module.state.cvId2 == 0) {
        modules.update((ms) => {
            ms[module.state.cvId2].removeOutput(module.state.id+".2", module.cv2);
            return ms;
        })
    }
    
    if (out.state.inputId == module.state.id) output.update((o) => {o.state.inputId = null; return o});
    Object.values(mods).forEach((m) => {
        if (m.state.inputId != null && m.state.inputId == module.state.id) {
            modules.update((ms) => {ms[m.state.id].state.inputId = null; return ms})
        }
        if (m.state.cvId != null && m.state.cvId == module.state.id) {
            modules.update((ms) => {ms[m.state.id].state.cvId = null; return ms})
        }
        if (m.state.cvId2 != null && m.state.cvId2 == module.state.id) {
            modules.update((ms) => {ms[m.state.id].state.cvId2 = null; return ms})
        }
        if (m.state.type == 'mixer') {
            modules.update((ms) => {
                ms[m.state.id].state.inputIds.forEach((inputId, i) => {
                    if (inputId == module.state.id) ms[m.state.id].state.inputIds[i] = null;
                });
                return ms;
            });
        }
    });

    modules.update((ms) => {delete ms[module.state.id]; return ms;});
};

// Highlights modules that can be selected as inputs and causes currently selected module to bob
export function inputsAllHover(module) {
    Object.values(mods).forEach((m) => {
        if (!m.isAudio && (module == null || m.state.id != module.state.id)) {
            m.fade();
        } else if ((module != null && m.state.id == module.state.inputId) || (module == null && m.state.id == out.state.inputId)) {
            m.bob();
        }
    });
}

export function mixerInputHover(module, inputId) {
    Object.values(mods).forEach((m) => {
        if (m.state.id != module.state.id && (!m.isAudio || (module.state.inputIds.includes(m.state.id) && m.state.id != inputId))) {
            m.fade();
        } else if (inputId != null && m.state.id == inputId) {
            m.bob();
        }
    });
}

export function cvsAllHover(module, inputId=0) {
    Object.values(mods).forEach((m) => {
        if (!m.isControl && m.state.id != module.state.id) {
            m.fade();
        } else if (module != null && ((m.state.id == module.state.cvId && inputId == 0) || (m.state.id == module.state.cvId2 && inputId == 1))) {
            m.bob();
        }
    });
}

export function unhover() {
    Object.values(mods).forEach((m) => {
        m.unfade();
    });
}

export function setPosition() {
    let pos = { x: 350, y: 100 };
    let spaceNotFound = true;
    while (spaceNotFound) {
        let spaceTaken = false;
        Object.values(mods).forEach((m) => {
            if (m.state.position && m.state.position.x == pos.x && m.state.position.y == pos.y) spaceTaken = true;
        });
        if (spaceTaken) {
            pos.x += 20;
            pos.y += 20;
        } else {
            spaceNotFound = false;
        }
    }
    return pos;
}

export function moduleInUse(module) {
    if (out.state.inputId == module.state.id) return true;
    Object.values(mods).forEach((m) => {
        if (m.state.inputId != null && m.state.inputId == module.state.id) {
            return true;
        }
        if (m.state.type == 'mixer') {
            m.state.inputIds.forEach((inputId) => {
                if (inputId == module.state.id) return true;
            });
        }
    });
    return false;
}
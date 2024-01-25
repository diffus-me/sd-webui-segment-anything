function samGetRealCoordinate(image, x1, y1) {
    if (image.naturalHeight * (image.width / image.naturalWidth) <= image.height) {
        // width is filled, height has padding
        const scale = image.naturalWidth / image.width
        const zero_point = (image.height - image.naturalHeight / scale) / 2
        const x = x1 * scale
        const y = (y1 - zero_point) * scale
        return [x, y]
    } else {
        // height is filled, width has padding
        const scale = image.naturalHeight / image.height
        const zero_point = (image.width - image.naturalWidth / scale) / 2
        const x = (x1 - zero_point) * scale
        const y = y1 * scale
        return [x, y]
    }
}

function switchToInpaintUpload() {
    switch_to_img2img_tab(4)
    return arguments;
}

function samTabPrefix() {
    const tabItems = gradioApp().querySelectorAll('#tabs > .tabitem');
    const buttons = gradioApp().querySelectorAll("#tabs > div.tab-nav > button")

    for (let [tabItem, button] of PYTHON.zip(tabItems, buttons)) {
        if (button.className.startsWith("selected")) {
            if (tabItem.id === "tab_txt2img") {
                return "txt2img_sam_";
            }
            if (tabItem.id === "tab_img2img") {
                return "img2img_sam_";
            }
            return "_sam_"
        }
    }
    return "_sam_"
}

function samImmediatelyGenerate() {
    const runButton = gradioApp().getElementById(samTabPrefix() + "run_button");
    if (runButton && runButton.style.display !== "none") {
        runButton.click();
    }
}

function samIsRealTimePreview() {
    const realtime_preview = gradioApp().querySelector("#" + samTabPrefix() + "realtime_preview_checkbox input[type='checkbox']");
    return realtime_preview && realtime_preview.checked;
}

function samCreateDot(sam_image, image, coord, label) {
    const x = coord.x;
    const y = coord.y;
    const realCoord = samGetRealCoordinate(image, coord.x, coord.y);
    if (realCoord[0] >= 0 && realCoord[0] <= image.naturalWidth && realCoord[1] >= 0 && realCoord[1] <= image.naturalHeight) {
        const isPositive = label == (samTabPrefix() + "positive");
        const circle = document.createElement("div");
        circle.style.position = "absolute";
        circle.style.width = "10px";
        circle.style.height = "10px";
        circle.style.borderRadius = "50%";
        circle.style.left = x + "px";
        circle.style.top = y + "px";
        circle.className = label;
        circle.style.backgroundColor = isPositive ? "black" : "red";
        circle.title = (isPositive ? "positive" : "negative") + " point label, left click it to cancel.";
        sam_image.appendChild(circle);
        circle.addEventListener("click", e => {
            e.stopPropagation();
            circle.remove();
            if (gradioApp().querySelectorAll("." + samTabPrefix() + "positive").length != 0 ||
                gradioApp().querySelectorAll("." + samTabPrefix() + "negative").length != 0) {
                if (samIsRealTimePreview()) {
                    samImmediatelyGenerate();
                }
            }
        });
        if (samIsRealTimePreview()) {
            samImmediatelyGenerate();
        }
    }
}

function samRemoveDots() {
    const sam_image = gradioApp().getElementById(samTabPrefix() + "input_image");
    if (sam_image) {
        ["." + samTabPrefix() + "positive", "." + samTabPrefix() + "negative"].forEach(cls => {
            const dots = sam_image.querySelectorAll(cls);
    
            dots.forEach(dot => {
                dot.remove();
            });
        })
    }
    return arguments;
}

function create_submit_sam_args(args) {
    res = []
    for (var i = 0; i < args.length; i++) {
        res.push(args[i])
    }

    res[res.length - 1] = null

    return res
}


function submit_dino() {
    const tab_prefix = samTabPrefix();
    addGenerateGtagEvent(`#${tab_prefix}dino_run_button > span`, `${tab_prefix}dino_generation_button`);

    res = []
    for (var i = 0; i < arguments.length; i++) {
        res.push(arguments[i])
    }

    res[res.length - 2] = null
    res[res.length - 1] = null
    return res
}

async function submit_sam() {
    const tab_prefix = samTabPrefix();
    addGenerateGtagEvent(`#${tab_prefix}run_button > span`, `${tab_prefix}generation_button`);
    await tierCheckButtonInternal("SegmentAnything");

    let res = create_submit_sam_args(arguments);
    let positive_points = [];
    let negative_points = [];
    const sam_image = gradioApp().getElementById(samTabPrefix() + "input_image");
    const image = sam_image.querySelector('img');
    const classes = ["." + samTabPrefix() + "positive", "." + samTabPrefix() + "negative"];
    classes.forEach(cls => {
        const dots = sam_image.querySelectorAll(cls);
        dots.forEach(dot => {
            const width = parseFloat(dot.style["left"]);
            const height = parseFloat(dot.style["top"]);
            if (cls == "." + samTabPrefix() + "positive") {
                positive_points.push(samGetRealCoordinate(image, width, height));
            } else {
                negative_points.push(samGetRealCoordinate(image, width, height));
            }
        });
    });
    res[2] = positive_points;
    res[3] = negative_points;
    return res
}

samPrevImg = {
    "txt2img_sam_": null,
    "img2img_sam_": null,
}

onUiUpdate(() => {
    const sam_image = gradioApp().getElementById(samTabPrefix() + "input_image")
    if (sam_image) {
        const image = sam_image.querySelector('img')
        if (image && samPrevImg[samTabPrefix()] != image.src) {
            samRemoveDots();
            samPrevImg[samTabPrefix()] = image.src;

            image.addEventListener("click", event => {
                const rect = event.target.getBoundingClientRect();
                const x = event.clientX - rect.left;
                const y = event.clientY - rect.top;

                samCreateDot(sam_image, event.target, { x, y }, samTabPrefix() + "positive");
            });

            image.addEventListener("contextmenu", event => {
                event.preventDefault();
                const rect = event.target.getBoundingClientRect();
                const x = event.clientX - rect.left;
                const y = event.clientY - rect.top;

                samCreateDot(sam_image, event.target, { x, y }, samTabPrefix() + "negative");
            });

            const observer = new MutationObserver(mutations => {
                mutations.forEach(mutation => {
                    if (mutation.type === 'attributes' && mutation.attributeName === 'src' && mutation.target === image) {
                        samRemoveDots();
                        samPrevImg[samTabPrefix()] = image.src;
                    }
                });
            });

            observer.observe(image, { attributes: true });
        } else if (!image) {
            samRemoveDots();
            samPrevImg[samTabPrefix()] = null;
        }
    }
})

async function submit_cneg_seg() {
    const tab_prefix = samTabPrefix();
    addGenerateGtagEvent(`#${tab_prefix}cnet_seg_run_button > span`, `${tab_prefix}cnet_seg_generation_button`);
    await tierCheckButtonInternal("SegmentAnything");
    return arguments;
}

async function submit_crop() {
    const tab_prefix = samTabPrefix();
    addGenerateGtagEvent(`#${tab_prefix}crop_run_button > span`, `${tab_prefix}crop_generation_button`);
    await tierCheckButtonInternal("SegmentAnything");
    return arguments;
}

function monitorImageResolution(tab_id) {
    return async (...values) => {
        const src = values[0];
        let resolution = [512, 512];
        if (src) {
            resolution = await getImageResolutionFromSrc(src);
        }

        const observer = monitorThisParam(
            tab_id,
            "extensions.segment_anything",
            ["width", "height"],
            (extractor = (_) => resolution),
        );
        return await observer(...values);
    };
}

function getImageResolutionFromSrc(src) {
    return new Promise((resolve, _) => {
        const img = new Image();
        img.src = src;
        img.onload = () => {
            resolve([img.naturalWidth, img.naturalHeight]);
        };
    });
}

async function monitorButton(tab_name, button_id) {
    systemMonitorState[tab_name] = {
        generate_button_id: button_id,
        timeout_id: null,
        functions: {
            "extensions.segment_anything": {
                params: {
                    width: 512,
                    height: 512,
                    n_iter: 1,
                },
                link_params: {}, // tab_name: function_name
                mutipliers: {}, // multipler_name: value
                link_mutipliers: {}, // function_name: param_name
            },
        },
    };
    await updateButton(tab_name);
}

onUiLoaded(async function () {
    await monitorButton("txt2img_sam_run_interface", "txt2img_sam_run_button");
    await monitorButton("img2img_sam_run_interface", "img2img_sam_run_button");

    await monitorButton("txt2img_sam_dino_run_interface", "txt2img_sam_dino_run_button");
    await monitorButton("img2img_sam_dino_run_interface", "img2img_sam_dino_run_button");

    await monitorButton("txt2img_sam_cnet_seg_run_interface", "txt2img_sam_cnet_seg_run_button");
    await monitorButton("img2img_sam_cnet_seg_run_interface", "img2img_sam_cnet_seg_run_button");

    await monitorButton("txt2img_sam_crop_run_interface", "txt2img_sam_crop_run_button");
    await monitorButton("img2img_sam_crop_run_interface", "img2img_sam_crop_run_button");
});

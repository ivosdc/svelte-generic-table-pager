<svelte:options tag={'table-pager'} accessors/>
<script>
    import {createEventDispatcher, onMount, beforeUpdate, afterUpdate} from 'svelte';
    import {GenericTablePagerService} from "./GenericTablePagerService";
    import {iconLeft, iconRight} from './SvgIcons'
    import SvelteGenericCrudTable from 'svelte-generic-crud-table/crud-table';

    /* istanbul ignore next line */
    export let shadowed = false;
    const dispatch = createEventDispatcher();

    const pager_config_default = {
        name: 'table-paginator',
        lines: 0,
        steps: [1],
        width: '500px'
    }

    /* istanbul ignore next line */
    export let pager_data = {};
    /* istanbul ignore next line */
    $: pager_data = (typeof pager_data === 'string') ? JSON.parse(pager_data) : pager_data;

    /* istanbul ignore next line */
    export let pager_config = pager_config_default;
    /* istanbul ignore next line */
    $: pager_config = (typeof pager_config === 'string') ? JSON.parse(pager_config) : pager_config;
    let setSteps = () => {
        let steps = (pager_config.steps !== undefined) ? pager_config.steps : pager_config_default.steps;
        steps = steps.filter((a) => {
            return parseInt(a) < pager_data.length
        });
        steps.push(pager_data.length);
        return steps;
    }

    let sliderIndex = (pager_config.steps !== undefined) ? pager_config.steps.indexOf(pager_config.lines) : 0;
    let maxSteps = 1;
    let currentStep = 0;
    $: currentStep = (pager_config.steps !== undefined) ? pager_config.steps[sliderIndex] : pager_config_default.steps[sliderIndex];
    $: maxSteps = (pager_config.steps !== undefined) ? (pager_config.steps.length - 1) : (pager_config_default.steps.length - 1);

    let pagerService = new GenericTablePagerService();

    let currentPage = 1;

    let maxPages = 1;
    let max
    $: max = Math.ceil(pager_data.length / pager_config.lines);
    $: maxPages = max > 0 ? max : 1;


    export let page_data;
    $: page_data = typeof page_data === 'Array' ? page_data : [];

    if (!shadowed) {
        beforeUpdate(() => {
            initPage();
       });
    } else {
        afterUpdate(() => {
            initPage();
        });

    }


    function initPage() {
        page_data = pager_data.slice(pager_config.lines * (currentPage - 1), pager_config.lines * (currentPage));
    }


    function getNextPage() {
        if (currentPage < maxPages) {
            page_data = pager_data.slice(pager_config.lines * currentPage, pager_config.lines * (currentPage + 1));
            currentPage++;
        }
    }


    function getPreviousPage() {
        if (currentPage > 1) {
            page_data = pager_data.slice((pager_config.lines * currentPage) - pager_config.lines * 2,
                (pager_config.lines * (currentPage + 1)) - pager_config.lines * 2);
            currentPage--;
        }
    }


    function handleLeft(event) {
        if (currentPage > 1) {
            getPreviousPage();
        }
    }

    function handleRight(event) {
        getNextPage();
    }

    function handlePagerConfig(event) {
        currentPage = 1;
        pager_config.steps = setSteps();
        pager_config.lines = pager_config.steps[sliderIndex];
    }

    function dispatcher(name, details, event) {
        /* istanbul ignore next */
        if (shadowed) {
            event.target.dispatchEvent(
                new CustomEvent(name, {
                    composed: true,
                    detail: details
                }))
        } else {
            dispatch(name, details);
        }
    }

    let firstLineOfPage = 0;
    $: firstLineOfPage = () => {
        return (pager_config.lines * (currentPage - 1)) + 1;
    }


    let lastLineOfPage = 0;
    $: lastLineOfPage = () => {
        const last = pager_config.lines * (currentPage - 1) + pager_config.lines;
        return (last > pager_data.length) ? pager_data.length : last;
    }


    function handleCreate(event) {
        const details = {};
        dispatcher('create', details, event);
    }

    function handleDelete(event) {
        const details = {
            id: parseInt(event.detail.id) + (currentPage - 1) * currentStep,
            body: event.detail.body
        };
        dispatcher('delete', details, event);
    }

    function handleUpdate(event) {
        const details = {
            id: parseInt(event.detail.id) + (currentPage - 1) * currentStep,
            body: event.detail.body
        };
        dispatcher('update', details, event);
    }

    function handleDetail(event) {
        const details = {
            id: parseInt(event.detail.id) + (currentPage - 1) * currentStep,
            body: event.detail.body
        };
        dispatcher('details', details, event);
    }

    function handleSort(event) {
        const column = event.detail.column;
        const details = {
            column: column
        };
        dispatcher('sort', details, event);
    }

    export let table_config = {};


</script>

<main class="pager"
      style="width:{(pager_config.width !== undefined) ? pager_config.width : pager_config_default.width}">
    <span id="left" class="options left {(currentPage > 1) ? 'active' : 'inactive'}" style="float:left"
          on:click={(e) => handleLeft(e)} title="Left" tabindex="0">
        {#if (currentPage > 1)}
            {@html iconLeft}
        {:else}
            o
        {/if}
    </span>
    <span id="right"
          class="options right {(pager_data.length > (currentPage * pager_config.lines)) ? 'active' : 'inactive'}"
          style="float:left"
          on:click={(e) => handleRight(e)} title="Right" tabindex="0">
        {@html iconRight}
    </span>
    <span class="range" style="float:left">
        <input id="slider" type=range bind:value={sliderIndex} min=1 max={maxSteps} steps={maxSteps}
               on:input={handlePagerConfig}>
        <span class="number-rows"> {currentStep} rows</span>
    </span>
    <span class="info" style="clear:both">
        lines: <span class="number-lines">{firstLineOfPage()}-{lastLineOfPage()} ({pager_data.length})</span>
         -
        pages: <span class="number-pages">{currentPage}/{maxPages}</span>
    </span>
</main>
<SvelteGenericCrudTable on:delete={handleDelete}
                        on:update={handleUpdate}
                        on:create={handleCreate}
                        on:details={handleDetail}
                        on:sort={handleSort}
                        shadowed={shadowed}
                        table_config={table_config}
                        bind:table_data={page_data}/>

<style>

    main {
        position: inherit;
        padding-top: 0.4em;
    }

    .range {
        background: #fff;
        height: 1.3em;
        border-radius: 5rem;
        box-shadow: 1px 1px 1px rgba(255, 255, 255, 0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        padding-top: 0.3em;
        outline: none;
        border: none;
        text-align: left;
        color: #999999;
        font-size: 0.7em;
        font-weight: 200;
    }

    .number-rows {
        padding-left: 0.4em;
        padding-top: 0.1em;
    }

    .pager {
        text-align: center;
        min-width: 400px;
        max-width: 100%;
        margin-left: 1em;
        height: 1.8em;
    }

    .number-pages {
        font-size: 110%;
        font-weight: 200;
    }

    .number-lines {
        padding-top: 0.3em;
        font-size: 110%;
        font-weight: 200;
    }

    .info {
        position: relative;
        top: -0.2em;
        text-align: left;
        color: #999999;
        font-size: 0.7em;
        font-weight: 200;
        padding-left: 2em;
    }

    .inactive {
        visibility: hidden;
    }

    .active {
        visibility: visible;
    }

    .active:hover {
        color: limegreen;
        opacity: 80%;
    }

    .options {
        position: relative;
        top: -0.1em;
        width: 16px;
        height: 16px;
        padding: 0.2em;
        cursor: pointer;
        opacity: 60%;
        color: #999999;
    }

    .options:hover {
        opacity: 100%;
    }

    .options:focus {
        border: none;
        outline: none;
        opacity: 100%;
    }

    input[type="range"] {
        -webkit-appearance: none;
        width: 100px;
        background: transparent;
    }

    input[type="range"]:focus {
        outline: none;
    }

    input[type="range"]::-webkit-slider-thumb {
        -webkit-appearance: none;
        height: 1em;
        width: 1em;
        border-radius: 50%;
        background: #ffffff;
        margin-top: -0.25em;
        box-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);

        cursor: pointer;
    }

    input[type="range"]::-webkit-slider-runnable-track {
        width: 60%;
        height: 9px;
        background: #dddddd;
        border-radius: 3rem;

        transition: all 0.5s;
        cursor: pointer;
    }

    input[type="range"]:hover::-webkit-slider-runnable-track {
        background: #ff6e40;
    }

    input[type="range"]::-ms-track {
        width: 60%;
        cursor: pointer;
        height: 9px;

        transition: all 0.5s;
        /* Hides the slider so custom styles can be added */
        background: transparent;
        border-color: transparent;
        color: transparent;
    }

    input[type="range"]::-ms-thumb {
        height: 16px;
        width: 16px;
        border-radius: 50%;
        background: #ffffff;
        margin-top: -5px;
        box-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);

        cursor: pointer;
    }

    input[type="range"]::-ms-fill-lower {
        background: #bdbdbd;
        border-radius: 3rem;
    }

    input[type="range"]:focus::-ms-fill-lower {
        background: #ff6e40;
    }

    input[type="range"]::-ms-fill-upper {
        background: #bdbdbd;
        border-radius: 3rem;
    }

    input[type="range"]:focus::-ms-fill-upper {
        background: #ff6e40;
    }

    input[type="range"]::-moz-range-thumb {
        height: 16px;
        width: 16px;
        border-radius: 50%;
        background: #ffffff;
        margin-top: -5px;
        box-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);

        cursor: pointer;
    }

    input[type="range"]::-moz-range-track {
        width: 80%;
        height: 9px;
        background: #bdbdbd;
        border-radius: 3rem;

        transition: all 0.5s;
        cursor: pointer;
    }

    input[type="range"]:hover::-moz-range-track {
        background: #ff6e40;
    }


</style>

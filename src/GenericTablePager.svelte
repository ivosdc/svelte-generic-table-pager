<svelte:options tag={'table-pager'}/>
<script>
    import {createEventDispatcher, onMount} from 'svelte';
    import {GenericTablePagerService} from "./GenericTablePagerService";
    import {iconLeft, iconRight} from './SvgIcons'

    /* istanbul ignore next line */
    let shadowed = document.querySelector('table-pager') !== null ? true : false;

    const dispatch = createEventDispatcher();

    const table_config_default = {
        name: 'table-paginator',
        lines: 10
    }

    /* istanbul ignore next line */
    export let table_data = {};
    /* istanbul ignore next line */
    $: table_data = (typeof table_data === 'string') ? JSON.parse(table_data) : table_data;

    /* istanbul ignore next line */
    export let table_config = table_config_default;
    /* istanbul ignore next line */
    $: table_config = (typeof table_config === 'string') ? JSON.parse(table_config) : table_config;

    let pagerService = new GenericTablePagerService();
    $: pagerService = new GenericTablePagerService();

    let currentPage = 0;

    let maxLines = table_data.length + 1;

    let pageData = [];

    let maxPages = 0;
    $: maxPages = Math.ceil(maxLines / table_config.lines)

    onMount(initFirstPage)


    function initFirstPage(event) {
        getNextPage()
        dispatcher('newpage', pageData, event);
    }

    function getNextPage() {
        if (currentPage < maxPages) {
            pageData = table_data.slice(table_config.lines * currentPage, table_config.lines * (currentPage + 1));
            currentPage++;
        }
    }

    function getPreviousPage() {
        if (currentPage > 1) {
            pageData = table_data.slice((table_config.lines * currentPage) - table_config.lines * 2,
                    (table_config.lines * (currentPage + 1)) - table_config.lines * 2);
            currentPage--;
        }
    }

    function handleLeft(event) {
        if (currentPage > 1) {
            getPreviousPage();
            dispatcher('newpage', pageData, event);
        }
        if (currentPage === 1) {
            if (shadowed) {
                document.querySelector('table-pager').shadowRoot.getElementById('left').classList.remove('active');
                document.querySelector('table-pager').shadowRoot.getElementById('left').classList.add('inactive');
            } else {
                document.getElementById('left').classList.remove('active');
                document.getElementById('left').classList.add('inactive');
            }
        }
        if (currentPage === maxPages - 1) {
            if (shadowed) {
                document.querySelector('table-pager').shadowRoot.getElementById('right').classList.remove('inactive');
                document.querySelector('table-pager').shadowRoot.getElementById('right').classList.add('active');
            } else {
                document.getElementById('right').classList.remove('inactive');
                document.getElementById('right').classList.add('active');
            }
        }
    }

    function handleRight(event) {
        if (currentPage < maxPages) {
            if (currentPage === 1) {
                if (shadowed) {
                    document.querySelector('table-pager').shadowRoot.getElementById('left').classList.remove('inactive');
                    document.querySelector('table-pager').shadowRoot.getElementById('left').classList.add('active');
                } else {
                    document.getElementById('left').classList.remove('inactive');
                    document.getElementById('left').classList.add('active');
                }
            }
            getNextPage();
            dispatcher('newpage', pageData, event);
        }
        if (currentPage === maxPages) {
            if (shadowed) {
                document.querySelector('table-pager').shadowRoot.getElementById('right').classList.remove('active');
                document.querySelector('table-pager').shadowRoot.getElementById('right').classList.add('inactive');
            } else {
                document.getElementById('right').classList.remove('active');
                document.getElementById('right').classList.add('inactive');
            }
        }
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
        return table_config.lines * (currentPage - 1);
    }


    let lastLineOfPage = 0;
    $: lastLineOfPage = () => {
        const last = table_config.lines * (currentPage - 1) + table_config.lines;
        return (last > table_data.length) ? table_data.length : last;
    }
</script>

<main class="pager">
    <span id="left" class="options left inactive" style="float:left"
          on:click={(e) => handleLeft(e)} title="Left" tabindex="0">
        {@html iconLeft}
    </span>
    <span class="info">
        line: <span class="number">{firstLineOfPage()}-{lastLineOfPage()}</span>
        /
        page: <span class="number">{currentPage}/{maxPages}</span>
    </span>
    <span id="right" class="options right active" style="float:right"
          on:click={(e) => handleRight(e)} title="Right" tabindex="0">
        {@html iconRight}
    </span>

</main>

<style>

    .pager {
        text-align: center;
        min-width: 180px;
        max-width: 180px;
    }


    .number {
        font-size: 0.65em;
    }

    .info {
        position: relative;
        top: 0.25em;
        color: #999999;
        font-size: 0.7em;
        font-weight: 200;
        width: 200px;
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
        top: 0.25em;
        width: 16px;
        height: 16px;
        padding: 0.2em 0.4em;
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

</style>

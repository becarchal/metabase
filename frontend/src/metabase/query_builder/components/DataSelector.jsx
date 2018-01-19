import React, { Component } from "react";
import { connect } from "react-redux";
import PropTypes from "prop-types";
import { t } from 'c-3po';
import Icon from "metabase/components/Icon.jsx";
import PopoverWithTrigger from "metabase/components/PopoverWithTrigger.jsx";
import AccordianList from "metabase/components/AccordianList.jsx";
import LoadingAndErrorWrapper from "metabase/components/LoadingAndErrorWrapper"

import { isQueryable } from 'metabase/lib/table';
import { titleize, humanize } from 'metabase/lib/formatting';

import { fetchTableMetadata } from "metabase/redux/metadata";
import { getMetadata } from "metabase/selectors/metadata";

import _ from "underscore";

const DATABASE_STEP = 'DATABASE';
const SCHEMA_STEP = 'SCHEMA';
const TABLE_STEP = 'TABLE';
const FIELD_STEP = 'FIELD';
const SEGMENT_STEP = 'SEGMENT';
const SEGMENT_AND_DATABASE_STEP = 'SEGMENT_AND_DATABASE';

const mapDispatchToProps = {
    fetchTableMetadata,
};

const mapStateToProps = (state, props) => ({
    metadata: getMetadata(state, props)
})

@connect(mapStateToProps, mapDispatchToProps)
export default class DataSelector extends Component {
    constructor(props) {
        super();

        const steps = props.includeTables ? [SCHEMA_STEP, TABLE_STEP] : [DATABASE_STEP];
        if (props.includeFields) { steps.push(FIELD_STEP); }
        if (props.segments) { steps.push(SEGMENT_STEP); }

        this.state = {
            activeStep: null,
            steps: steps,
            stepHistory: [],
            stateChangeHistory: [],
            databases: null,
            selectedSchema: null,
            selectedTable: null,
            showSegmentPicker: props.segments && props.segments.length > 0
        };
    }

    static propTypes = {
        databases: PropTypes.array.isRequired,
        tables: PropTypes.array,
        segments: PropTypes.array,
        sourceTable: PropTypes.object,
        disabledTableIds: PropTypes.array,
        disabledSegmentIds: PropTypes.array,
        setDatabaseFn: PropTypes.func.isRequired,
        setSourceTableFn: PropTypes.func,
        setSourceSegmentFn: PropTypes.func,
        isInitiallyOpen: PropTypes.bool,
        includeTables: PropTypes.bool,
        includeFields: PropTypes.bool,
        renderAsSelect: PropTypes.bool,
    };

    static defaultProps = {
        isInitiallyOpen: false,
        includeTables: false,
        includeFields: true,
        renderAsSelect: false,
    };

    componentWillMount() {
        this.componentWillReceiveProps(this.props);
        if (this.props.databases.length === 1 && !this.props.segments) {
            setTimeout(() => this.onChangeDatabase(0));
        }
    }

    componentWillReceiveProps(newProps) {
        const tableId = newProps.sourceTable && newProps.sourceTable.id;
        let selectedSchema;
        // augment databases with schemas
        let databases = newProps.databases && newProps.databases.map(database => {
            let schemas = {};
            for (let table of database.tables.filter(isQueryable)) {
                let name = table.schema || "";
                schemas[name] = schemas[name] || {
                    name: titleize(humanize(name)),
                    database: database,
                    tables: []
                }
                schemas[name].tables.push(table);
                if (table.id === tableId) {
                    selectedSchema = schemas[name];
                }
            }
            schemas = Object.values(schemas);
            // Hide the schema name if there is only one schema
            if (schemas.length === 1) {
                schemas[0].name = "";
            }
            return {
                ...database,
                schemas: schemas.sort((a, b) => a.name.localeCompare(b.name))
            };
        });
        this.setState({ databases });
        if (selectedSchema != undefined) {
            this.setState({ selectedSchema })
        }
        if (!this.state.activeStep) { this.updateActiveStep(); }
    }

    closeIfLastStep() {
        if (this.state.activeStep === this.state.steps[this.state.steps.length - 1]) {
            this.refs.popover.toggle();
        }
    }

    onBack = () => {
        const newHistory = this.state.stepHistory.slice();
        const previousStep = newHistory.pop();
        this.setState({
            activeStep: previousStep.name,
            stepHistory: newHistory,
            ...previousStep.stateChange
        });
    }

    onChangeTable = (item) => {
        if (item.table != null) {
            this.props.setSourceTableFn(item.table.id);
            this.stepChange({selectedTable: item.table});
        } else if (item.database != null) {
            this.props.setDatabaseFn(item.database.id);
        }
        this.closeIfLastStep();
    }

    onChangeField = (item) => {
        if (item.field != null) {
            console.log('field selected: ', item.field);
        }
        this.closeIfLastStep();
    }

    onChangeSegment = (item) => {
        if (item.segment != null) {
            this.props.setSourceSegmentFn(item.segment.id);
        }
    }

    onChangeSchema = (schema) => {
        this.stepChange({selectedSchema: schema});
    }

    onChangeSegmentSection = () => {
        this.setState({
            showSegmentPicker: true
        });
    }

    onChangeDatabase = (index) => {
        let database = this.state.databases[index];
        let schema = database && (database.schemas.length > 1 ? null : database.schemas[0]);
        if (database && database.tables.length === 0) {
            schema = {
                database: database,
                name: "",
                tables: []
            };
        }
        this.stepChange({selectedSchema: schema});
    }

    getSegmentId() {
        return this.props.datasetQuery.segment;
    }

    getDatabaseId() {
        return this.state.selectedSchema &&
                    this.state.selectedSchema.database &&
                    this.state.selectedSchema.database.id;
    }

    getTableId() {
        return this.state.selectedTable && this.state.selectedTable.id;
    }

    getFieldId() {
        return this.state.selectedField && this.state.selectedField.id;
    }

    getTriggerElement() {
        const { databases, renderAsSelect } = this.props;

        if (renderAsSelect) {

        } else {
            const dbId = this.getDatabaseId();
            const tableId = this.getTableId();
            const database = _.find(databases, (db) => db.id === dbId);
            const table = _.find(database && database.tables, (table) => table.id === tableId);

            let content;
            if (this.props.includeTables && this.props.segments) {
                const segmentId = this.getSegmentId();
                const segment = _.find(this.props.segments, (segment) => segment.id === segmentId);
                if (table) {
                    content = <span className="text-grey no-decoration">{table.display_name || table.name}</span>;
                } else if (segment) {
                    content = <span className="text-grey no-decoration">{segment.name}</span>;
                } else {
                    content = <span className="text-grey-4 no-decoration">{t`Pick a segment or table`}</span>;
                }
            } else if (this.props.includeTables) {
                if (table) {
                    content = <span className="text-grey no-decoration">{table.display_name || table.name}</span>;
                } else {
                    content = <span className="text-grey-4 no-decoration">{t`Select a table`}</span>;
                }
            } else {
                if (database) {
                    content = <span className="text-grey no-decoration">{database.name}</span>;
                } else {
                    content = <span className="text-grey-4 no-decoration">{t`Select a database`}</span>;
                }
            }

            return (
                <span className={this.props.className || "px2 py2 text-bold cursor-pointer text-default"} style={this.props.style}>
                    {content}
                    <Icon className="ml1" name="chevrondown" size={this.props.triggerIconSize || 8}/>
                </span>
            );
        }
    }

    fetchStepData() {
        switch(this.state.activeStep) {
            case FIELD_STEP: return this.props.fetchTableMetadata(this.state.selectedTable.id);
        }
    }

    stepChange(stateChange) {
        let stateChangeHistoryEntry = Object.keys(stateChange).reduce((hitoryEntry, key) => {
            hitoryEntry[key] = this.state[key];
            return hitoryEntry;
        }, {});

        this.setState(stateChange, this.updateActiveStep.bind(this, stateChangeHistoryEntry));
    }

    updateActiveStep(stateChangeHistoryEntry) {
        const stepHistory = [];
        let activeStep = DATABASE_STEP;

        if (this.props.includeTables) {
            activeStep = SCHEMA_STEP;

            if (this.state.selectedSchema) {
                stepHistory.push({name: activeStep});
                activeStep = TABLE_STEP;
            }

            if (this.state.steps.includes(FIELD_STEP) &&
                    this.state.selectedTable) {
                stepHistory.push({name: activeStep});
                activeStep = FIELD_STEP;
            }

            if (this.state.steps.includes(SEGMENT_STEP)) {
                stepHistory.push({name: activeStep});
                activeStep = this.getSegmentId() ? SEGMENT_STEP : SEGMENT_AND_DATABASE_STEP;
            }
        }

        if (stepHistory.length && stateChangeHistoryEntry) {
            stepHistory[stepHistory.length - 1].stateChange = stateChangeHistoryEntry;
        }
        this.setState({ activeStep, stepHistory }, this.fetchStepData);
    }

    renderLoading(header) {
        return (
            <section className="List-section List-section--open" style={{width: 300}}>
                <div className="p1 border-bottom">
                    <div className="px1 py1 flex align-center">
                        <h3 className="text-default">{header}</h3>
                    </div>
                </div>
                <LoadingAndErrorWrapper loading />;
            </section>
        );
    }

    renderDatabasePicker = ({ maxHeight }) => {
        const { databases } = this.state;

        if (databases.length === 0) {
            return <LoadingAndErrorWrapper loading />;
        }

        let sections = [{
            items: databases.map(database => ({
                name: database.name,
                database: database
            }))
        }];

        return (
            <AccordianList
                id="DatabasePicker"
                key="databasePicker"
                className="text-brand"
                maxHeight={maxHeight}
                sections={sections}
                onChange={this.onChangeTable}
                itemIsSelected={(item) => item.database.id == this.getDatabaseId()}
                renderItemIcon={() => <Icon className="Icon text-default" name="database" size={18} />}
                showItemArrows={false}
            />
        );
    }

    renderDatabaseSchemaPicker = ({ maxHeight }) => {
        const { databases, selectedSchema } = this.state;

        if (databases.length === 0) {
            return <LoadingAndErrorWrapper loading />;
        }

        if (this.props.renderAsSelect) {
            // let sections = [{
            //     name: header,
            //     items: selectedSchema.tables
            //         .map(table => ({
            //             name: table.display_name,
            //             disabled: this.props.disabledTableIds && this.props.disabledTableIds.includes(table.id),
            //             table: table,
            //             database: selectedDatabase
            //         }))
            // }];
            // return (
            //     <div style={{ width: 300 }}>
            //         <AccordianList
            //             id="DatabaseSchemaPicker"
            //             key="databaseSchemaPicker"
            //             className="text-brand"
            //             maxHeight={maxHeight}
            //             sections={sections}
            //             searchable
            //             onChange={this.onChangeSchema}
            //             itemIsSelected={(schema) => schema === selectedSchema}
            //         />
            //     </div>
            // );
        } else {
            const sections = databases
                .map(database => ({
                    name: database.name,
                    items: database.schemas.length > 1 ? database.schemas : [],
                    className: database.is_saved_questions ? "bg-slate-extra-light" : null,
                    icon: database.is_saved_questions ? 'all' : 'database'
                }));

            let openSection = selectedSchema && _.findIndex(databases, (db) => _.find(db.schemas, selectedSchema));
            if (openSection >= 0 && databases[openSection] && databases[openSection].schemas.length === 1) {
                openSection = -1;
            }

            return (
                <div>
                    <AccordianList
                        id="DatabaseSchemaPicker"
                        key="databaseSchemaPicker"
                        className="text-brand"
                        maxHeight={maxHeight}
                        sections={sections}
                        onChange={this.onChangeSchema}
                        onChangeSection={this.onChangeDatabase}
                        itemIsSelected={(schema) => schema === selectedSchema}
                        renderSectionIcon={item =>
                            <Icon
                                className="Icon text-default"
                                name={item.icon}
                                size={18}
                            />
                        }
                        renderItemIcon={() => <Icon name="folder" size={16} />}
                        initiallyOpenSection={openSection}
                        showItemArrows={true}
                        alwaysTogglable={true}
                    />
                </div>
            );
        }

    }

    renderSegmentAndDatabasePicker = ({ maxHeight }) => {
        const { selectedSchema } = this.state;

        const segmentItem = [{ name: 'Segments', items: [], icon: 'segment'}];

        const sections = segmentItem.concat(this.state.databases.map(database => {
            return {
                name: database.name,
                items: database.schemas.length > 1 ? database.schemas : []
            };
        }));

        // FIXME: this seems a bit brittle and hard to follow
        let openSection = selectedSchema && (_.findIndex(this.state.databases, (db) => _.find(db.schemas, selectedSchema)) + segmentItem.length);
        if (openSection >= 0 && this.state.databases[openSection - segmentItem.length] && this.state.databases[openSection - segmentItem.length].schemas.length === 1) {
            openSection = -1;
        }

        return (
            <AccordianList
                id="SegmentAndDatabasePicker"
                key="segmentAndDatabasePicker"
                className="text-brand"
                maxHeight={maxHeight}
                sections={sections}
                onChange={this.onChangeSchema}
                onChangeSection={(index) => index === 0 ?
                    this.onChangeSegmentSection() :
                    this.onChangeDatabase(index - segmentItem.length)
                }
                itemIsSelected={(schema) => this.state.selectedSchema === schema}
                renderSectionIcon={(section, sectionIndex) => <Icon className="Icon text-default" name={section.icon || "database"} size={18} />}
                renderItemIcon={() => <Icon name="folder" size={16} />}
                initiallyOpenSection={openSection}
                showItemArrows={true}
                alwaysTogglable={true}
            />
        );
    }

    renderTablePicker = ({ maxHeight }) => {
        const { selectedSchema, selectedTable } = this.state;
        const selectedDatabase = selectedSchema && selectedSchema.database;
        const isSavedQuestionList = selectedDatabase.is_saved_questions;
        const hasMultipleDatabases = this.props.databases.length > 1;
        const hasMultipleSchemas = selectedDatabase && _.uniq(selectedDatabase.tables, (t) => t.schema).length > 1;
        const hasSegments = !!this.props.segments;
        const hasMultipleSources = hasMultipleDatabases || hasMultipleSchemas || hasSegments;

        let header = (
            <div className="flex flex-wrap align-center">
                <span className="flex align-center text-brand-hover cursor-pointer" onClick={hasMultipleSources && this.onBack}>
                    {hasMultipleSources && <Icon name="chevronleft" size={18} /> }
                    <span className="ml1">{selectedDatabase.name}</span>
                </span>
                { selectedSchema.name && <span className="ml1 text-slate">- {selectedSchema.name}</span>}
            </div>
        );

        if (selectedSchema.tables.length === 0) {
            // this is a database with no tables!
            return (
                <section className="List-section List-section--open" style={{width: 300}}>
                    <div className="p1 border-bottom">
                        <div className="px1 py1 flex align-center">
                            <h3 className="text-default">{header}</h3>
                        </div>
                    </div>
                    <div className="p4 text-centered">{t`No tables found in this database.`}</div>
                </section>
            );
        } else {
            let sections = [{
                name: header,
                items: selectedSchema.tables
                    .map(table => ({
                        name: table.display_name,
                        disabled: this.props.disabledTableIds && this.props.disabledTableIds.includes(table.id),
                        table: table,
                        database: selectedDatabase
                    }))
            }];
            return (
                <div style={{ width: 300 }}>
                    <AccordianList
                        id="TablePicker"
                        key="tablePicker"
                        className="text-brand"
                        maxHeight={maxHeight}
                        sections={sections}
                        searchable
                        onChange={this.onChangeTable}
                        itemIsSelected={(item) => item.table ? item.table.id === this.getTableId() : false}
                        itemIsClickable={(item) => item.table && !item.disabled}
                        renderItemIcon={(item) => item.table ? <Icon name="table2" size={18} /> : null}
                    />
                    { isSavedQuestionList && (
                        <div className="bg-slate-extra-light p2 text-centered border-top">
                            {t`Is a question missing?`}
                            <a href="http://metabase.com/docs/latest/users-guide/04-asking-questions.html#source-data" className="block link">{t`Learn more about nested queries`}</a>
                        </div>
                    )}
                </div>
            );
        }
    }

    renderFieldPicker = ({ maxHeight }) => {
        const { selectedField } = this.state;
        const table = this.props.metadata.tables[this.getTableId()];
        const fields = (table && table.fields) || [];
        const header = (
            <span className="flex align-center">
                <span className="flex align-center text-slate cursor-pointer" onClick={this.onBack}>
                    <Icon name="chevronleft" size={18} />
                    <span className="ml1">{t`Fields`}</span>
                </span>
            </span>
        );

        // fields are loading
        if (fields.length === 0) {
            return this.renderLoading(header);
        }

        const sections = [{
            name: header,
            items: fields.map(field => ({
                name: field.display_name,
                // disabled: this.props.disabledTableIds && this.props.disabledTableIds.includes(table.id),
                field: field,
                // database: schema.database
            }))
        }];

        return (
            <div style={{ width: 300 }}>
                <AccordianList
                    id="FieldPicker"
                    key="fieldPicker"
                    className="text-brand"
                    maxHeight={maxHeight}
                    sections={sections}
                    searchable
                    onChange={this.onChangeField}
                    itemIsSelected={(item) => item.field ? item.field.id === this.getFieldId() : false}
                    itemIsClickable={(item) => item.field && !item.disabled}
                    renderItemIcon={(item) => item.field ? <Icon name="table2" size={18} /> : null}
                />
            </div>
        );
    }

    //TODO: refactor this. lots of shared code with renderTablePicker = () =>
    renderSegmentPicker = ({ maxHeight }) => {
        const { segments } = this.props;
        const header = (
            <span className="flex align-center">
                <span className="flex align-center text-slate cursor-pointer" onClick={this.onBack}>
                    <Icon name="chevronleft" size={18} />
                    <span className="ml1">{t`Segments`}</span>
                </span>
            </span>
        );

        if (!segments || segments.length === 0) {
            return (
                <section className="List-section List-section--open" style={{width: '300px'}}>
                    <div className="p1 border-bottom">
                        <div className="px1 py1 flex align-center">
                            <h3 className="text-default">{header}</h3>
                        </div>
                    </div>
                    <div className="p4 text-centered">{t`No segments were found.`}</div>
                </section>
            );
        }

        const sections = [{
            name: header,
            items: segments
                .map(segment => ({
                    name: segment.name,
                    segment: segment,
                    disabled: this.props.disabledSegmentIds && this.props.disabledSegmentIds.includes(segment.id)
                }))
        }];

        return (
            <AccordianList
                id="SegmentPicker"
                key="segmentPicker"
                className="text-brand"
                maxHeight={maxHeight}
                sections={sections}
                searchable
                searchPlaceholder={t`Find a segment`}
                onChange={this.onChangeSegment}
                itemIsSelected={(item) => item.segment ? item.segment.id === this.getSegmentId() : false}
                itemIsClickable={(item) => item.segment && !item.disabled}
                renderItemIcon={(item) => item.segment ? <Icon name="segment" size={18} /> : null}
                hideSingleSectionTitle={true}
            />
        );
    }

    renderActiveStep() {
        switch(this.state.activeStep) {
            case DATABASE_STEP:             return this.renderDatabasePicker;
            case SCHEMA_STEP:               return this.renderDatabaseSchemaPicker;
            case TABLE_STEP:                return this.renderTablePicker;
            case FIELD_STEP:                return this.renderFieldPicker;
            case SEGMENT_STEP:              return this.renderSegmentPicker;
            case SEGMENT_AND_DATABASE_STEP: return this.renderSegmentAndDatabasePicker;
        }
    }

    render() {
        return (
            <PopoverWithTrigger
                id="DataPopover"
                ref="popover"
                isInitiallyOpen={this.props.isInitiallyOpen}
                triggerElement={this.getTriggerElement()}
                triggerClasses="flex align-center"
                horizontalAttachments={this.props.segments ? ["center", "left", "right"] : ["left"]}
            >
                { this.renderActiveStep() }
            </PopoverWithTrigger>
        );
    }
}

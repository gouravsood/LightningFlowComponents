import {LightningElement, wire, api, track} from 'lwc';
import {getObjectInfo} from 'lightning/uiObjectInfoApi';

export default class FlowCombobox extends LightningElement {
    @api name;
    @api label;
    @api required = false;
    @api flowContextFilterType;
    @api valueIsCollection;
    @api maxWidth;
    @track _dataType;
    @track _value;
    @track allOptions;
    @track _options = [];
    @track _mergeFields = [];
    @track dropdownClass = 'slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click';
    @track isDataSelected = false;
    @track _selectedObjectType;
    @track _selectedFieldPath;
    isMenuOpen = false;
    isDataModified = false;
    selfEvent = false;
    key = 0;

    labels = {
        noDataAvailable: 'No data available'
    };
    iconsPerType = {
        String: 'utility:text',
        Boolean: 'utility:check',
        Date: 'utility:date_input',
        DateTime: 'utility:date_time',
        Number: 'utility:number_input',
        Int: 'utility:number_input',
        Double: 'utility:number_input',
        Picklist: 'utility:picklist',
        TextArea: 'utility:textarea',
        Phone: 'utility:phone_portrait',
        Address: 'utility:location',
        Currency: 'utility:currency_input',
        Url: 'utility:link',
        SObject: 'utility:sobject'
    };

    typeDescriptors = [
        {apiName: 'variables', label: 'Variables', dataType: 'dataType'},
        {apiName: 'constants', label: 'Global Constants', dataType: 'String'},
        {apiName: 'textTemplates', label: 'Variables', dataType: 'String'},
        {apiName: 'stages', label: 'Variables', dataType: 'String'},
        {apiName: 'screens.fields', label: 'Screen Components', dataType: 'String'},
        {apiName: 'screens.fields.inputParameters', label: 'Screen Components', dataType: 'String'},
        {apiName: 'recordLookups', label: 'Variables', dataType: 'SObject'},
        {apiName: 'formulas', label: 'Formulas', dataType: 'String'},
        {apiName: 'actionCalls.inputParameters', label: 'Variables', dataType: 'String'},
        {apiName: 'actionCalls.outputParameters', label: 'Variables', dataType: 'String'},
        {apiName: 'apexPluginCalls', label: 'Variables', dataType: 'String'},
    ];

    settings = {
        stringDataType: 'String',
        referenceDataType: 'reference'
    };

    @api
    get value() {
        return this._value;
    }

    set value(value) {
        this._value = value;
        this.isDataSelected = !!this._value;
        this.determineSelectedType();
    }

    @api
    get valueType() {
        return this._dataType;
    }

    set valueType(value) {
        if (!this._dataType) {
            if (value) {
                this._dataType = value;
            } else {
                this._dataType = this.settings.stringDataType;
            }

        }
    }

    @api get flowContext() {
        return this._flowContext;
    }

    set flowContext(value) {
        this._flowContext = value;
        this._mergeFields = this.generateMergeFieldsFromFlowContext(this._flowContext);
        this.setOptions(this._mergeFields);
        this.determineSelectedType();
    }

    get displayPill() {
        return this.isDataSelected && this._dataType === this.settings.referenceDataType;
    }

    setOptions(value) {
        this._options = value;
        this.allOptions = JSON.parse(JSON.stringify(this._options));
        this.processOptions();
    }

    @wire(getObjectInfo, {objectApiName: '$_selectedObjectType'})
    _getObjectInfo({error, data}) {
        if (error) {
            this.errors.push(error.body[0].message);
        } else if (data) {
            let tempOptions = [];
            let localKey = 0;
            Object.keys(data.fields).forEach(curField => {
                let curFieldData = data.fields[curField];
                let curDataType = curFieldData.dataType === 'Reference' ? 'SObject' : curFieldData.dataType;
                let curObjectType = curFieldData.referenceToInfos.length ? curFieldData.referenceToInfos[0].apiName : null;
                tempOptions.push({
                    type: curDataType,
                    label: curFieldData.label,
                    value: curFieldData.apiName,
                    isCollection: false,
                    objectType: curObjectType,
                    optionIcon: this.getIconNameByType(curDataType),
                    isObject: curDataType === 'SObject',
                    displayType: curDataType === 'SObject' ? curObjectType : curDataType,
                    key: 'fieldDescriptor' + localKey++
                });


            });
            this.setOptions([{type: data.label + ' Fields', options: tempOptions}]);

        }
    }

    getTypes() {
        return this.typeDescriptors.map(curTypeDescriptor => curTypeDescriptor.apiName);
    }

    getTypeDescriptor(typeApiName) {
        return this.typeDescriptors.find(curTypeDescriptor => curTypeDescriptor.apiName === typeApiName);
    }

    determineSelectedType() {
        if (this._value && this.allOptions) {
            let valParts = this._value.replace(/[^a-zA-Z0-9._-]/g, '').split('.');
            if (valParts.length > 1) {
                this.allOptions.forEach(curOption => {
                    let localOptions = curOption.options;
                    let selectedOption = localOptions.find(curSelectedOption => curSelectedOption.value === valParts[0]);
                    if (selectedOption) {
                        this._selectedObjectType = selectedOption.displayType;
                        valParts.pop();
                        this._selectedFieldPath = valParts.join('.');
                    }
                });
            }
        }
    }

    generateMergeFieldsFromFlowContext(flowContext) {
        let optionsByType = {};
        let key = 0;

        this.getTypes().forEach(curType => {
            let typeParts = curType.split('.');
            let typeOptions = [];

            if (typeParts.length && flowContext[typeParts[0]]) {
                let objectToExamine = flowContext;
                let parentNodeLabel = '';
                typeParts.forEach(curTypePart => {

                    if (objectToExamine[curTypePart]) {
                        objectToExamine = objectToExamine[curTypePart].map(curItem => {
                            parentNodeLabel = curItem.label ? curItem.label : curItem.name;
                            return {
                                ...curItem,
                                varApiName: curItem.name,
                                varLabel: parentNodeLabel
                            }
                        });
                    } else {
                        if (Array.isArray(objectToExamine)) {
                            let allObjectToExamine = [];
                            objectToExamine.forEach(curObjToExam => {
                                allObjectToExamine = [...allObjectToExamine, ...curObjToExam[curTypePart].map(curItem => {
                                    return {
                                        ...curItem, varApiName: curObjToExam.name + '.' + curItem.name,
                                        varLabel: (curObjToExam.label ? curObjToExam.label : parentNodeLabel) + ': ' + curItem.name
                                    }
                                })];
                            });
                            objectToExamine = allObjectToExamine;
                        }
                    }

                });

                let curTypeOptions = this.getOptionLines(objectToExamine, 'varLabel', 'varApiName', 'dataType', 'isCollection', 'objectType');
                if (curTypeOptions.length) {
                    typeOptions = [...typeOptions, ...curTypeOptions];
                }
                if (typeOptions.length) {
                    let localType = this.getTypeDescriptor(curType).label;
                    if (optionsByType[localType]) {
                        optionsByType[localType] = [...optionsByType[localType], ...typeOptions];
                    } else {
                        optionsByType[localType] = typeOptions;
                    }
                }
            } else {
                console.log(curType + ' is undefined');
            }
        });
        let options = [];
        let allOutputTypes = Object.keys(optionsByType);

        if (allOutputTypes.length) {
            allOutputTypes.forEach(curKey => {
                options.push({type: curKey, options: optionsByType[curKey]});
            });
        }
        return options;
    }

    getOptionLines(objectArray, labelField, valueField, typeField, isCollectionField, objectTypeField) {
        let typeOptions = [];
        objectArray.forEach(curObject => {
            let curDataType = curObject[typeField] ? curObject[typeField] : 'String';
            typeOptions.push({
                type: curDataType,
                label: curObject[labelField] ? curObject[labelField] : curObject[valueField],
                value: curObject[valueField],
                isCollection: !!curObject[isCollectionField],
                objectType: curObject[objectTypeField],
                optionIcon: this.getIconNameByType(curDataType),
                isObject: curDataType === 'SObject',
                displayType: curDataType === 'SObject' ? curObject[objectTypeField] : curDataType,
                key: 'flowCombobox-' + this.key++
            });
        });
        return typeOptions;
    }

    handleOpenObject(event) {
        event.stopPropagation();
        this._selectedFieldPath = (this._selectedFieldPath ? this._selectedFieldPath + '.' : '') + event.currentTarget.dataset.optionValue;
        this._selectedObjectType = event.currentTarget.dataset.objectType;
    }

    handleSetSelectedRecord(event) {
        if (event.currentTarget.dataset) {
            this._dataType = this.settings.referenceDataType;
            this.value = this.getFullPath(this._selectedFieldPath, event.currentTarget.dataset.value);
            this.isDataModified = true;
            this.closeOptionDialog();
        }
    }

    dispatchValueChangedEvent() {
        const valueChangedEvent = new CustomEvent('valuechanged', {
            detail: {
                id: this.name,
                newValue: this._value ? this._value : '',
                newValueDataType: this._dataType
            }
        });
        this.dispatchEvent(valueChangedEvent);
    }

    resetData(event) {
        this.value = '';
        this._selectedFieldPath = '';
        this._selectedObjectType = null;
        this._dataType = this.settings.stringDataType;
        this.setOptions(this._mergeFields);
        this.closeOptionDialog();
    }

    openOptionDialog(event) {
        // this.isDataSelected = false;
        this.isMenuOpen = true;
        this.dropdownClass = 'slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click slds-is-open';
    }

    closeOptionDialog(setValueInput) {

        if (this._value) {
            this.isDataSelected = true;
        }
        this.isMenuOpen = false;
        this.dropdownClass = 'slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click';

        if (setValueInput) {
            this.setValueInput();
        }

        if (this.isDataModified) {
            this.dispatchValueChangedEvent();
            this.isDataModified = false;
        }
    }

    constructor() {
        super();
        document.addEventListener('click', this.handleWindowClick.bind(this));
    }

    disconnectedCallback() {
        document.removeEventListener('click', this.handleWindowClick.bind(this));
    }

    handleWindowClick(event) {
        console.log(Date.now());
        if (!event.path.includes(this.template.host) && !this.selfEvent) {
            this.closeOptionDialog(true);
        }
        this.selfEvent = false;
    }

    processOptions(searchString) {
        let searchLC = searchString ? searchString.toLowerCase() : '';
        this._options = [];
        this.allOptions.forEach(curOption => {
            let localOptions = curOption.options;

            if (this.flowContextFilterType) {
                localOptions = localOptions.filter(opToFilter => opToFilter.displayType === this.flowContextFilterType);
            }

            if (typeof this.valueIsCollection !== "undefined") {
                localOptions = localOptions.filter(opToFilter => opToFilter.isCollection === this.valueIsCollection);
            }

            if (searchLC) {
                localOptions = localOptions.filter(opToFilter => opToFilter.label.toLowerCase().includes(searchLC) || opToFilter.value.toLowerCase().includes(searchLC.replace(/\W/g, '')));
            }

            if (localOptions.length) {
                this._options.push({
                    ...curOption, ...{
                        options: localOptions,
                    }
                });
            }
        });
    }

    getIconNameByType(variableType) {
        return this.iconsPerType[variableType];
    }

    handleOpenOptions(event) {
        // event.stopPropagation();
        console.log('handleOpenOptions');
        this.selfEvent = true;
        if (this.isMenuOpen) {
            this.isDataSelected = false;
            this._value = this.formattedValue(this._value);
        } else {
            this.openOptionDialog();
        }

    }

    handleOpenEditDialog(event) {
        event.stopPropagation();
        this.handleOpenOptions(event);
    }

    handleCloseOptions(event) {
        this.closeOptionDialog();
    }

    handleSearchField(event) {
        let currentText = event.target.value;
        if (this.isReference(currentText)) {
            this._dataType = this.settings.referenceDataType;
        } else {
            this._dataType = this.settings.stringDataType;
        }

        this.isDataModified = true;
        this.isDataSelected = false;

        this.processOptions(currentText);
        if (this.allOptions.length) {
            this.openOptionDialog();
        }
    }

    handleSearchKeyUp(event) {
        if (event.key === "Enter") {
            if (this.isMenuOpen) {
                this.closeOptionDialog(true);
            } else {
                this.openOptionDialog();
            }
        }
    }

    setValueInput() {
        let valueInput = this.template.querySelector('.value-input');
        if (valueInput) {
            let isReference = this.isReference(valueInput.value);
            this._value = this.removeFormatting(valueInput.value);
            if (isReference) {
                this._dataType = this.settings.referenceDataType;
            } else {
                this._dataType = this.settings.stringDataType;
            }
        }
    }

    isReference(value) {
        let isReference = value.indexOf('{!') === 0 && value.lastIndexOf('}') === (value.length - 1);
        return isReference;
    }

    getFullPath(path, val) {
        return (path ? path + '.' : '') + val;
    }

    formattedValue(value) {
        if (this.isReference(value)) {
            return value;
        } else {
            return this._dataType === this.settings.referenceDataType ? '{!' + value + '}' : value;
        }
    }

    removeFormatting(value) {
        let isReference = this.isReference(value);
        let clearValue = isReference ? value.substring(0, value.lastIndexOf('}')).replace('{!', '') : value;
        return clearValue;
    }

    get inputStyle() {
        if (this.maxWidth) {
            return 'max-width: ' + this.maxWidth + 'px;';
        }
    }

    splitValues = (originalString) => {
        if (originalString) {
            return originalString.replace(/ /g, '').split(',');
        } else {
            return [];
        }
    }
}
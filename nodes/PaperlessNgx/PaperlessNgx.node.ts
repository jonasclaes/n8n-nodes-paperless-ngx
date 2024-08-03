import {
	BINARY_ENCODING,
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IRequestOptions,
	NodeOperationError,
	PaginationOptions,
	// NodeOperationError,
} from 'n8n-workflow';
import { Readable } from 'stream';

type ValueOf<T> = T[keyof T];

export const Resource = {
	Correspondent: 'correspondent',
	DocumentType: 'documentType',
	Document: 'document',
} as const;

export const Operation = {
	Create: 'create',
	Read: 'read',
	Update: 'update',
	Delete: 'delete',
} as const;

export class PaperlessNgx implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Paperless-ngx Node',
		name: 'paperlessNgx',
		icon: 'file:paperlessNgx.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{ $parameter["operation"] + ": " + $parameter["resource"] }}',
		description: 'Paperless-ngx node',
		defaults: {
			name: 'Paperless-ngx node',
		},
		inputs: ['main'],
		outputs: ['main'],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				options: [
					{
						name: 'Correspondent',
						value: Resource.Correspondent,
					},
					{
						name: 'Document Type',
						value: Resource.DocumentType,
					},
					{
						name: 'Document',
						value: Resource.Document,
					},
				],
				default: 'document',
				noDataExpression: true,
				required: true,
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				displayOptions: {
					show: {
						resource: [Resource.Document],
					},
				},
				options: [
					{
						name: 'Create',
						value: Operation.Create,
						description: 'Create a document',
						action: 'Create a document',
					},
					{
						name: 'Read',
						value: Operation.Read,
						description: 'Get documents',
						action: 'Get documents',
					},
				],
				default: 'read',
				noDataExpression: true,
				required: true,
			},
			{
				displayName: 'File',
				name: 'file',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: [Resource.Document],
						operation: [Operation.Create],
					},
				},
				default: '',
				description: 'File to add',
			},
			{
				displayName: 'Additional Fields',
				name: 'additionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: {
					show: {
						resource: [Resource.Document],
						operation: [Operation.Read],
					},
				},
				options: [
					{
						displayName: 'Search',
						name: 'search',
						type: 'string',
						default: '',
					},
				],
			},
		],
		credentials: [
			{
				name: 'paperlessNgxApi',
				required: true,
			},
		],
	};

	// The function below is responsible for actually doing whatever this node
	// is supposed to do. In this case, we're just appending the `myString` property
	// with whatever the user has entered.
	// You can make async calls and use `await`.
	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();

		const credentials = await this.getCredentials('paperlessNgxApi');

		const resource = this.getNodeParameter('resource', 0) as ValueOf<typeof Resource>;
		const operation = this.getNodeParameter('operation', 0) as ValueOf<typeof Operation>;

		const returnData: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				if (resource === Resource.Document) {
					if (operation === Operation.Read) {
						const additionalFields = this.getNodeParameter(
							'additionalFields',
							itemIndex,
						) as IDataObject;

						const requestOptions: IRequestOptions = {
							headers: {
								Accept: 'application/json',
							},
							qs: {
								search: additionalFields.search,
							},
							method: 'GET',
							uri: `${credentials.domain}/api/documents/`,
							json: true,
						};

						const paginationOptions: PaginationOptions = {
							continue: '={{ $response.body["next"] !== null }}',
							request: {
								url: '={{ $response.body["next"] }}',
							},
							requestInterval: 1,
						};

						const responseData = await this.helpers.requestWithAuthenticationPaginated.call(
							this,
							requestOptions,
							itemIndex,
							paginationOptions,
							'paperlessNgxApi',
						);
						const items = responseData.flatMap((response) =>
							response.body.results.map((result: any) => ({ json: result })),
						);
						returnData.push(...items);
					}

					if (operation === Operation.Create) {

						const documentFieldName = this.getNodeParameter('file', itemIndex, 'data') as string;
						const documentData = this.helpers.assertBinaryData(itemIndex, documentFieldName);
						const documentBinaryData = items[itemIndex].binary![documentFieldName];
						let documentUploadData: Buffer | Readable;

						if (documentBinaryData.id) {
							documentUploadData = await this.helpers.getBinaryStream(documentBinaryData.id);
						} else {
							documentUploadData = Buffer.from(documentBinaryData.data, BINARY_ENCODING);
						}

						const requestOptions: IRequestOptions = {
							method: 'POST',
							formData: {
								document: {
									value: documentUploadData,
									options: {
										filename: documentData.fileName,
										contentType: documentData.mimeType,
									},
								},
							},
							uri: `${credentials.domain}/api/documents/post_document/`,
							json: true,
						};

						const responseData = await this.helpers.requestWithAuthentication.call(
							this,
							'paperlessNgxApi',
							requestOptions,
							undefined,
							itemIndex,
						);
						returnData.push({ json: { task_id: responseData } });
					}
				}
			} catch (error) {
				if (this.continueOnFail()) {
					items.push({ json: this.getInputData(itemIndex)[0].json, error, pairedItem: itemIndex });
				} else {
					if (error.context) {
						error.context.itemIndex = itemIndex;
						throw error;
					}

					throw new NodeOperationError(this.getNode(), error, {
						itemIndex,
					});
				}
			}
		}

		return this.prepareOutputData(returnData);
	}
}

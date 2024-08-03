import {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class PaperlessNgxApi implements ICredentialType {
	name = 'paperlessNgxApi';
	// eslint-disable-next-line n8n-nodes-base/cred-class-field-display-name-miscased
	displayName = 'Paperless-ngx API';
	documentationUrl = 'https://docs.paperless-ngx.com/api/';
	icon: Icon = {
		light: 'file:paperlessNgx.svg',
		dark: 'file:paperlessNgx.svg'
	};
	properties: INodeProperties[] = [
		{
			displayName: 'Domain',
			name: 'domain',
			type: 'string',
			default: '',
			required: true
		},
		{
			displayName: 'Token',
			name: 'token',
			type: 'string',
			default: '',
			typeOptions: {
				password: true
			},
			required: true
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Token {{$credentials.token}}'
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.domain}}',
			url: '/api/documents/',
		},
	};
}

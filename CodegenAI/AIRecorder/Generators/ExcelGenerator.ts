import { FileWriter } from "../FileWriter";

export class ExcelGenerator {

	private writer =
		new FileWriter();

	public generate(
		file: string,
		content: string
	) {

		this.writer.writeFile(
			file,
			content
		);

	}

}

import fs from "fs";
import path from "path";

export class FileWriter {

	public writeFile(
		file: string,
		content: string
	) {

		const folder =
			path.dirname(file);

		if (!fs.existsSync(folder))
			fs.mkdirSync(folder, { recursive: true });

		fs.writeFileSync(
			file,
			content,
			"utf8"
		);

	}

}
